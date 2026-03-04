/**
 * myDATA (AADE) REST API client - server-side only.
 * Fetches expense documents from AADE myDATA.
 * Uses Node.js https module (more stable than fetch for external APIs).
 */

import https from "https";

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

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/myDATA/RequestMyExpenses`);
  const body = buildRequestXml(dateFrom, dateTo);

  return doRequest(url, body, userId, subscriptionKey, timeoutMs);
}

function doRequest(
  url: URL,
  body: string,
  userId: string,
  subscriptionKey: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "aade-user-id": userId,
        "ocp-apim-subscription-key": subscriptionKey,
        "Content-Type": "text/xml",
        "Content-Length": Buffer.byteLength(body, "utf8"),
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
            doRequest(redirectUrl, body, userId, subscriptionKey, timeoutMs)
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

    req.write(body, "utf8");
    req.end();
  });
}

function buildRequestXml(dateFrom: string, dateTo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<RequestMyExpenses>
  <dateFrom>${escapeXml(dateFrom)}</dateFrom>
  <dateTo>${escapeXml(dateTo)}</dateTo>
</RequestMyExpenses>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
