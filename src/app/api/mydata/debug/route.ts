/**
 * Debug endpoint to inspect myDATA API responses.
 * GET /api/mydata/debug?date=2026-03-04
 * Returns: RequestMyExpenses structure (does it have issuerName?) and RequestDocs status.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { requestMyExpenses, requestDocs } from "@/lib/mydata/client";
import { getMyDataCredentials } from "@/lib/mydata/credentials";
import { parseMyExpensesResponse } from "@/lib/mydata/parser";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;

  const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!DATE_REGEX.test(date)) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  const creds = await getMyDataCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Credentials missing" }, { status: 400 });
  }

  const baseUrl = process.env.MYDATA_BASE_URL ?? "https://mydatapi.aade.gr";
  const docsPath = process.env.MYDATA_REQUEST_DOCS_PATH ?? "/myDATA/RequestDocs";
  const [y, m, d] = date.split("-");
  const ddMmYyyy = `${d}/${m}/${y}`;

  const result: Record<string, unknown> = {
    date,
    baseUrl,
    requestDocsPath: docsPath,
    requestDocsUrl: `${baseUrl}${docsPath}?mark=0&dateFrom=${ddMmYyyy}&dateTo=${ddMmYyyy}`,
  };

  try {
    const expensesRaw = await requestMyExpenses(date, date, creds);
    const normalized = parseMyExpensesResponse(expensesRaw);
    const withName = normalized.filter((n) => n.issuerName && n.issuerName.trim().length > 1);
    result.requestMyExpensesOk = true;
    result.requestMyExpensesCount = normalized.length;
    result.withIssuerNameCount = withName.length;
    result.sampleWithName =
      withName.slice(0, 3).map((n) => ({ vat: n.issuerVat, name: n.issuerName })) ?? [];
    result.sampleWithoutName =
      normalized.filter((n) => !n.issuerName?.trim()).slice(0, 3).map((n) => ({ vat: n.issuerVat })) ?? [];
    result.rawPreview = expensesRaw.slice(0, 1500);
  } catch (e) {
    result.requestMyExpensesOk = false;
    result.requestMyExpensesError = e instanceof Error ? e.message : "Unknown";
  }

  try {
    const docsRaw = await requestDocs(date, date, creds);
    result.requestDocsOk = true;
    result.requestDocsLength = docsRaw.length;
    result.requestDocsPreview = docsRaw.slice(0, 1500);
  } catch (e) {
    result.requestDocsOk = false;
    result.requestDocsError = e instanceof Error ? e.message : "Unknown";
  }

  return NextResponse.json(result);
}
