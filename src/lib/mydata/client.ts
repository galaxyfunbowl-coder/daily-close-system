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
export type RequestDocsResult = {
  issuerNames: Map<string, string>;
  urlsByMark: Map<string, string>;
};

export async function requestDocsEnriched(
  dateFrom: string,
  dateTo: string,
  credentials: MyDataCredentialsParam | undefined,
  maxRetryDays: number
): Promise<RequestDocsResult> {
  const issuerNames = new Map<string, string>();
  const urlsByMark = new Map<string, string>();
  const mergeResult = (r: ReturnType<typeof parseRequestDocsData>): void => {
    for (const [k, v] of r.issuerNames) if (k && v) issuerNames.set(k, v);
    for (const [k, v] of r.urlsByMark) if (k && v) urlsByMark.set(k, v);
  };

  try {
    const docsText = await requestDocs(dateFrom, dateTo, credentials);
    mergeResult(parseRequestDocsData(docsText));
    return { issuerNames, urlsByMark };
  } catch {
    // Retry per-day when range fails
  }

  const allDates = iterateDates(dateFrom, dateTo);
  const dates = allDates.length > maxRetryDays
    ? allDates.slice(-maxRetryDays)
    : allDates;
  for (const d of dates) {
    try {
      const docsText = await requestDocs(d, d, credentials);
      mergeResult(parseRequestDocsData(docsText));
    } catch {
      // Skip this day
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { issuerNames, urlsByMark };
}

/** @deprecated Use requestDocsEnriched */
export async function requestDocsIssuerNames(
  dateFrom: string,
  dateTo: string,
  credentials: MyDataCredentialsParam | undefined,
  maxRetryDays: number
): Promise<Map<string, string>> {
  const result = await requestDocsEnriched(dateFrom, dateTo, credentials, maxRetryDays);
  return result.issuerNames;
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

export type RequestDocsInvoiceInfo = {
  issuerName: string;
  downloadingInvoiceUrl?: string;
};

/**
 * Extract Map<vatNumber, InvoiceInfo> from RequestDocs response (invoicesDoc).
 * Also extracts downloadingInvoiceUrl per mark.
 */
export function parseRequestDocsData(responseText: string): {
  issuerNames: Map<string, string>;
  urlsByMark: Map<string, string>;
} {
  const issuerNames = new Map<string, string>();
  const urlsByMark = new Map<string, string>();
  const trimmed = responseText.trim();
  if (!trimmed) return { issuerNames, urlsByMark };
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
    return { issuerNames, urlsByMark };
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
      if (vat && name && vat.length >= 8) issuerNames.set(vat, name);
    }
    const mark = String(r.mark ?? r.Mark ?? r.MARK ?? "").trim();
    const dlUrl = String(r.downloadingInvoiceUrl ?? r.DownloadingInvoiceUrl ?? "").trim();
    if (mark && dlUrl && dlUrl.startsWith("http")) {
      urlsByMark.set(mark, dlUrl);
    }
    for (const v of Object.values(r)) {
      if (Array.isArray(v)) v.forEach(extract);
      else extract(v);
    }
  };
  extract(parsed);
  return { issuerNames, urlsByMark };
}

/**
 * @deprecated Use parseRequestDocsData instead
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
