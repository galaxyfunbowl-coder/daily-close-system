/**
 * myDATA (AADE) REST API client - server-side only.
 * Fetches expense documents from AADE myDATA.
 * Uses Node.js https module (more stable than fetch for external APIs).
 */

import https from "https";
import { XMLParser } from "fast-xml-parser";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type MyDataCredentialsParam = {
  userId: string;
  subscriptionKey: string;
};

export function requestMyExpenses(
  dateFrom: string,
  dateTo: string,
  credentials?: MyDataCredentialsParam
): Promise<string> {
  if (!DATE_REGEX.test(dateFrom) || !DATE_REGEX.test(dateTo)) {
    return Promise.reject(new Error("Invalid date format. Use YYYY-MM-DD."));
  }

  const userId =
    credentials?.userId ?? process.env.MYDATA_USER_ID ?? "";
  const subscriptionKey =
    credentials?.subscriptionKey ?? process.env.MYDATA_SUBSCRIPTION_KEY ?? "";
  const baseUrl = process.env.MYDATA_BASE_URL ?? "https://mydatapi.aade.gr";
  const timeoutMs = Number(process.env.MYDATA_TIMEOUT_MS) || 60000;

  if (!userId || !subscriptionKey) {
    return Promise.reject(
      new Error(
        "myDATA credentials missing. Set MYDATA_USER_ID and MYDATA_SUBSCRIPTION_KEY in .env.local or CompanySettings."
      )
    );
  }

  const path = process.env.MYDATA_PATH ?? "/myDATA/RequestMyExpenses";
  const base = baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  const dateFromDdMm = toDdMmYyyy(dateFrom);
  const dateToDdMm = toDdMmYyyy(dateTo);
  url.searchParams.set("dateFrom", dateFromDdMm);
  url.searchParams.set("dateTo", dateToDdMm);

  return doRequest(url, userId, subscriptionKey, timeoutMs);
}

/**
 * RequestDocs - returns full documents (παραστατικά) with issuer/counterpart details.
 * Per official doc: invoices have issuer (PartyType) with vatNumber and name (επωνυμία).
 * Used to build VAT -> company name map for expenses.
 */
export function requestDocs(
  dateFrom: string,
  dateTo: string,
  credentials?: MyDataCredentialsParam
): Promise<string> {
  if (!DATE_REGEX.test(dateFrom) || !DATE_REGEX.test(dateTo)) {
    return Promise.reject(new Error("Invalid date format. Use YYYY-MM-DD."));
  }
  const userId =
    credentials?.userId ?? process.env.MYDATA_USER_ID ?? "";
  const subscriptionKey =
    credentials?.subscriptionKey ?? process.env.MYDATA_SUBSCRIPTION_KEY ?? "";
  const baseUrl = process.env.MYDATA_BASE_URL ?? "https://mydatapi.aade.gr";
  const timeoutMs = Number(process.env.MYDATA_TIMEOUT_MS) || 60000;
  if (!userId || !subscriptionKey) {
    return Promise.reject(
      new Error("myDATA credentials missing.")
    );
  }
  const base = baseUrl.replace(/\/$/, "");
  const docsPath = process.env.MYDATA_REQUEST_DOCS_PATH ?? "/myDATA/RequestDocs";
  const url = new URL(`${base}${docsPath.startsWith("/") ? docsPath : `/${docsPath}`}`);
  url.searchParams.set("mark", "0");
  url.searchParams.set("dateFrom", toDdMmYyyy(dateFrom));
  url.searchParams.set("dateTo", toDdMmYyyy(dateTo));
  return doRequest(url, userId, subscriptionKey, timeoutMs);
}

/**
 * Fetches issuer names via RequestDocs. When the date range fails (e.g. cryptoKey error),
 * retries per-day to get partial results. Some days may still fail.
 * @param maxRetryDays - when retrying per-day, cap at this many days to avoid too many requests
 */
export async function requestDocsIssuerNames(
  dateFrom: string,
  dateTo: string,
  credentials: MyDataCredentialsParam | undefined,
  maxRetryDays: number
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const merge = (m: Map<string, string>): void => {
    for (const [vat, name] of m) {
      if (vat && name) map.set(vat, name);
    }
  };

  try {
    const docsText = await requestDocs(dateFrom, dateTo, credentials);
    merge(parseIssuerNamesFromRequestDocs(docsText));
    return map;
  } catch {
    // Retry per-day when range fails (e.g. cryptoKey cannot be empty for some dates)
  }

  const allDates = iterateDates(dateFrom, dateTo);
  const dates = allDates.length > maxRetryDays
    ? allDates.slice(-maxRetryDays)
    : allDates;
  for (const d of dates) {
    try {
      const docsText = await requestDocs(d, d, credentials);
      merge(parseIssuerNamesFromRequestDocs(docsText));
    } catch {
      // Skip this day
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return map;
}

function iterateDates(dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const cur = new Date(from);
  while (cur <= to) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Extract Map<vatNumber, companyName> from RequestDocs response (invoicesDoc).
 * issuer = εκδότης = supplier for our received invoices.
 */
export function parseIssuerNamesFromRequestDocs(responseText: string): Map<string, string> {
  const map = new Map<string, string>();
  const trimmed = responseText.trim();
  if (!trimmed) return map;
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  });
  let parsed: unknown;
  try {
    parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : parser.parse(trimmed);
  } catch {
    return map;
  }
  const extract = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    const r = obj as Record<string, unknown>;
    const issuer = r.issuer ?? r.Issuer;
    if (issuer && typeof issuer === "object") {
      const i = issuer as Record<string, unknown>;
      const vatRaw = String(
        i.vatNumber ?? i.VatNumber ?? i.vat_number ?? i.vat ?? i.afm ?? ""
      ).trim();
      const name = String(
        i.name ?? i.Name ?? i.companyName ?? i.registrationName ?? ""
      ).trim();
      const vat = vatRaw.replace(/\D/g, "");
      if (vat && name && vat.length >= 8) map.set(vat, name);
    }
    for (const v of Object.values(r)) {
      if (Array.isArray(v)) v.forEach(extract);
      else extract(v);
    }
  };
  extract(parsed);
  return map;
}

function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function doRequest(
  url: URL,
  userId: string,
  subscriptionKey: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "aade-user-id": userId,
        "ocp-apim-subscription-key": subscriptionKey,
      },
      timeout: timeoutMs,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const status = res.statusCode ?? 0;
        if (process.env.NODE_ENV === "development") {
          console.log(`[mydata] ${status} ${url.toString()}`);
        }
        if (status === 301 || status === 302) {
          const location = res.headers.location;
          if (location) {
            const redirectUrl = location.startsWith("http")
              ? new URL(location)
              : new URL(location, url.origin + "/");
            doRequest(redirectUrl, userId, subscriptionKey, timeoutMs)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        if (status >= 200 && status < 300) {
          resolve(text);
        } else {
          const baseHint = status === 404
            ? " Ελέγξτε MYDATA_BASE_URL (π.χ. https://mydatapi.aade.gr)."
            : "";
          reject(
            new Error(`myDATA API error ${status}: ${text.slice(0, 200)}${baseHint}`)
          );
        }
      });
      res.on("error", reject);
    });

    req.on("error", (e) => {
      reject(
        new Error(
          `myDATA connection failed: ${e instanceof Error ? e.message : String(e)}`
        )
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`myDATA request timed out after ${timeoutMs}ms`));
    });

    req.end();
  });
}
