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
  const url = new URL(`${base}/myDATA/RequestDocs`);
  url.searchParams.set("mark", "0");
  url.searchParams.set("dateFrom", toDdMmYyyy(dateFrom));
  url.searchParams.set("dateTo", toDdMmYyyy(dateTo));
  return doRequest(url, userId, subscriptionKey, timeoutMs);
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

/**
 * Request company info by VAT (ΑΦΜ) - returns company name from AADE registry.
 * Endpoint: /myDATA/RequestReceiverInfo?vat={vat}
 */
export function requestReceiverInfo(
  vat: string,
  credentials?: MyDataCredentialsParam
): Promise<string> {
  const vatClean = String(vat).replace(/\D/g, "");
  if (!vatClean || vatClean.length < 8) {
    return Promise.reject(new Error("Invalid VAT for RequestReceiverInfo"));
  }
  const vat9 = vatClean.length === 9 ? vatClean : vatClean.padStart(9, "0");
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
  const url = new URL(`${base}/myDATA/RequestReceiverInfo`);
  url.searchParams.set("vat", vat9);
  return doRequest(url, userId, subscriptionKey, timeoutMs);
}

const RECEIVER_NAME_KEYS = [
  "companyname", "company_name", "registrationname", "registration_name",
  "name", "title", "eponymia", "counterpartyname", "counterparty_name",
  "businessname", "business_name",
];

/** Extract company name from RequestReceiverInfo XML/JSON response */
export function parseReceiverInfoCompanyName(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  const tryJson = (): string | null => {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const walk = (o: unknown): string | null => {
        if (!o || typeof o !== "object") return null;
        const r = o as Record<string, unknown>;
        for (const k of Object.keys(r)) {
          if (RECEIVER_NAME_KEYS.some((n) => k.toLowerCase().includes(n))) {
            const v = r[k];
            if (typeof v === "string" && v.trim().length > 1) return v.trim();
          }
        }
        for (const v of Object.values(r)) {
          const found = walk(v);
          if (found) return found;
        }
        return null;
      };
      return walk(obj);
    } catch {
      return null;
    }
  };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return tryJson();

  for (const key of RECEIVER_NAME_KEYS) {
    const re = new RegExp(`<${key}[^>]*>([^<]+)</${key}>`, "i");
    const m = trimmed.match(re);
    if (m) return m[1].trim();
  }
  const anyTag = trimmed.match(/<(?:companyName|registrationName|name|eponymia)[^>]*>([^<]+)</i);
  if (anyTag) return anyTag[1].trim();
  return null;
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
        if (res.statusCode === 301 || res.statusCode === 302) {
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
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(text);
        } else {
          reject(
            new Error(`myDATA API error ${res.statusCode}: ${text.slice(0, 200)}`)
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
