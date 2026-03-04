/**
 * myDATA (AADE) REST API client - server-side only.
 * Fetches expense documents from AADE myDATA.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function requestMyExpenses(
  dateFrom: string,
  dateTo: string
): Promise<string> {
  if (!DATE_REGEX.test(dateFrom) || !DATE_REGEX.test(dateTo)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const userId = process.env.MYDATA_USER_ID;
  const subscriptionKey = process.env.MYDATA_SUBSCRIPTION_KEY;
  const baseUrl = process.env.MYDATA_BASE_URL ?? "https://mydataapi.aade.gr";
  const timeoutMs = Number(process.env.MYDATA_TIMEOUT_MS) || 15000;

  if (!userId || !subscriptionKey) {
    throw new Error(
      "myDATA credentials missing. Set MYDATA_USER_ID and MYDATA_SUBSCRIPTION_KEY."
    );
  }

  const url = `${baseUrl}/myDATA/RequestMyExpenses`;
  const body = buildRequestXml(dateFrom, dateTo);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "aade-user-id": userId,
        "ocp-apim-subscription-key": subscriptionKey,
        "Content-Type": "application/xml",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `myDATA API error ${res.status}: ${text.slice(0, 200)}`
      );
    }

    return text;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error) {
      if (e.name === "AbortError") {
        throw new Error(`myDATA request timed out after ${timeoutMs}ms`);
      }
      throw e;
    }
    throw new Error("myDATA request failed");
  }
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
