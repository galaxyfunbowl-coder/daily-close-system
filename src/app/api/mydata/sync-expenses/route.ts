import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  requestMyExpenses,
  requestDocs,
  parseIssuerNamesFromRequestDocs,
  requestReceiverInfo,
  parseReceiverInfoCompanyName,
} from "@/lib/mydata/client";
import { parseMyExpensesResponse, type NormalizedMyDataExpense } from "@/lib/mydata/parser";
import { getMyDataCredentials } from "@/lib/mydata/credentials";

export const maxDuration = 60;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackUniqueKey(n: NormalizedMyDataExpense): string {
  const parts = [
    n.issuerVat ?? "",
    n.issueDate ?? "",
    String(n.totalAmount ?? 0),
    n.invoiceType ?? "",
    n.aa ?? "",
  ];
  return parts.join("|");
}

function buildInvoiceNumber(n: NormalizedMyDataExpense): string | null {
  const parts = [n.series, n.aa].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return n.mark ? String(n.mark) : null;
}

const receiverInfoCache = new Map<string, string>();

function getCachedName(vat: string): string | undefined {
  const v = vat.replace(/\D/g, "");
  if (!v) return undefined;
  return (
    receiverInfoCache.get(v) ??
    receiverInfoCache.get(v.padStart(9, "0")) ??
    receiverInfoCache.get(v.replace(/^0+/, ""))
  );
}

function isFallbackName(name: string, vat: string): boolean {
  return name === `Προμηθευτής ${vat}` || name === `Προμηθευτής ${vat.replace(/\D/g, "")}`;
}

async function getOrCreateSupplier(
  issuerVat: string | undefined,
  issuerName: string | undefined,
  creds: { userId: string; subscriptionKey: string }
): Promise<{ id: string; defaultCategory: string } | null> {
  if (!issuerVat && !issuerName) return null;
  const vat = issuerVat?.trim().replace(/\D/g, "") || issuerVat?.trim();
  let name = issuerName?.trim();
  if (!name && vat) {
    const cached = getCachedName(vat);
    if (cached) name = cached;
    else {
      try {
        const resp = await requestReceiverInfo(vat, creds);
        const fetched = parseReceiverInfoCompanyName(resp);
        if (fetched) {
          name = fetched;
          receiverInfoCache.set(vat.replace(/\D/g, ""), fetched);
        }
      } catch {
        // ignore - use fallback name
      }
    }
  }
  const fallbackName = vat ? `Προμηθευτής ${vat}` : "Άγνωστος προμηθευτής";
  name = (name || fallbackName).slice(0, 200);
  const vatNorm = vat?.replace(/\D/g, "").replace(/^0+/, "") ?? "";
  const vatPadded = vatNorm.length === 8 ? `0${vatNorm}` : vatNorm;
  const existing = vat
    ? await prisma.supplier.findFirst({
        where: {
          OR: [
            { vatNumber: vat },
            { vatNumber: vatNorm },
            { vatNumber: vatPadded },
          ],
        },
        select: { id: true, defaultCategory: true, name: true },
      })
    : null;
  if (existing) {
    if (name !== fallbackName && isFallbackName(existing.name, vat ?? "")) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return { id: existing.id, defaultCategory: existing.defaultCategory };
  }
  const created = await prisma.supplier.create({
    data: {
      name,
      defaultCategory: "Λοιπά",
      vatNumber: vat ?? undefined,
    },
    select: { id: true, defaultCategory: true },
  });
  return created;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const creds = await getMyDataCredentials();
  return NextResponse.json({
    ok: true,
    ready: Boolean(creds),
    message: creds ? "myDATA API reachable" : "Credentials missing",
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth) return auth;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let dateFrom: string;
  let dateTo: string;
  let dryRun = false;
  let debug = false;

  try {
    const body = (await request.json()) as {
      dateFrom?: string;
      dateTo?: string;
      dryRun?: boolean;
      debug?: boolean;
    };
    dateFrom =
      typeof body.dateFrom === "string" && DATE_REGEX.test(body.dateFrom)
        ? body.dateFrom
        : todayISO();
    dateTo =
      typeof body.dateTo === "string" && DATE_REGEX.test(body.dateTo)
        ? body.dateTo
        : todayISO();
    dryRun = body.dryRun === true;
    debug = body.debug === true;
  } catch {
    dateFrom = todayISO();
    dateTo = todayISO();
  }

  const errors: { mark?: string; message: string }[] = [];
  let fetched = 0;
  let rawResponse = "";
  let inserted = 0;
  let updated = 0;
  let linkedExpenses = 0;
  let skipped = 0;

  try {
    if (dryRun) {
      return NextResponse.json({
        fetched: 0,
        inserted: 0,
        updated: 0,
        linkedExpenses: 0,
        skipped: 0,
        errors: [],
        message: "Dry run – AADE not called",
      });
    }
    const creds = await getMyDataCredentials();
    if (!creds) {
      return NextResponse.json(
        { error: "myDATA credentials missing. Set MYDATA_USER_ID and MYDATA_SUBSCRIPTION_KEY in .env.local or CompanySettings." },
        { status: 400 }
      );
    }
    const xmlText = await requestMyExpenses(dateFrom, dateTo, creds);
    rawResponse = xmlText;
    const normalized = parseMyExpensesResponse(xmlText);
    fetched = normalized.length;

    // RequestDocs returns full documents with issuer.name; pre-fill cache for supplier names
    try {
      const docsText = await requestDocs(dateFrom, dateTo, creds);
      const issuerNames = parseIssuerNamesFromRequestDocs(docsText);
      for (const [vat, name] of issuerNames) {
        if (vat && name) {
          const vatNorm = vat.replace(/\D/g, "");
          if (vatNorm) receiverInfoCache.set(vatNorm, name);
        }
      }
    } catch {
      // Continue without RequestDocs names; getOrCreateSupplier will use requestReceiverInfo fallback
    }

    for (const n of normalized) {
      const pk = n.mark || fallbackUniqueKey(n);
      if (!pk) {
        skipped++;
        errors.push({ message: "Missing mark and fallback key" });
        continue;
      }

      const issueDate = n.issueDate ?? todayISO();
      const totalAmount = n.totalAmount ?? 0;
      const description =
        [n.issuerName, n.issuerVat, n.aa, n.series]
          .filter(Boolean)
          .join(" ") || "myDATA έξοδο";
      const invoiceNumber = buildInvoiceNumber(n);

      const supplierMatch = await getOrCreateSupplier(n.issuerVat, n.issuerName, creds);
      const supplierId = supplierMatch?.id ?? null;
      const category = supplierMatch?.defaultCategory ?? "Λοιπά";

      const sourceRaw = n.rawSnippet
        ? JSON.stringify(n.rawSnippet)
        : null;

      const myDataData = {
        mark: n.mark,
        uid: n.uid ?? undefined,
        issuerVat: n.issuerVat ?? undefined,
        issuerName: n.issuerName ?? undefined,
        receiverVat: n.receiverVat ?? undefined,
        issueDate: n.issueDate ? new Date(n.issueDate) : undefined,
        invoiceType: n.invoiceType ?? undefined,
        series: n.series ?? undefined,
        aa: n.aa ?? undefined,
        netAmount: n.netAmount ?? undefined,
        vatAmount: n.vatAmount ?? undefined,
        totalAmount: n.totalAmount ?? undefined,
        currency: n.currency ?? undefined,
        cancellationMark: n.cancellationMark ?? undefined,
        isCancelled: n.isCancelled ?? false,
        sourceRaw: sourceRaw ?? undefined,
      };

      const existing = await prisma.myDataExpense.findUnique({
        where: { mark: n.mark },
        include: { expense: true },
      });

      let myDataExpense;
      if (existing) {
        myDataExpense = await prisma.myDataExpense.update({
          where: { mark: n.mark },
          data: myDataData,
        });
        updated++;

        if (existing.expense) {
          linkedExpenses++;
          if (
            existing.expense.source === "MYDATA" &&
            !existing.expense.userEdited
          ) {
            await prisma.expense.update({
              where: { id: existing.expense.id },
              data: {
                date: issueDate,
                amount: totalAmount,
                category: existing.expense.category || category,
                notes: description,
                supplierId: supplierId ?? existing.expense.supplierId,
                invoiceNumber: invoiceNumber ?? existing.expense.invoiceNumber,
              },
            });
          }
        } else {
          await prisma.expense.create({
            data: {
              date: issueDate,
              invoiceNumber: invoiceNumber,
              supplierId: supplierId,
              category,
              amount: totalAmount,
              paymentMethod: "Τραπεζική μεταφορά",
              notes: description,
              source: "MYDATA",
              userEdited: false,
              myDataExpenseId: myDataExpense.id,
            },
          });
          linkedExpenses++;
        }
      } else {
        myDataExpense = await prisma.myDataExpense.create({
          data: myDataData,
        });
        inserted++;

        const expense = await prisma.expense.create({
          data: {
            date: issueDate,
            invoiceNumber: invoiceNumber,
            supplierId: supplierId,
            category,
            amount: totalAmount,
            paymentMethod: "Τραπεζική μεταφορά",
            notes: description,
            source: "MYDATA",
            userEdited: false,
            myDataExpenseId: myDataExpense.id,
          },
        });
        linkedExpenses++;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("[mydata sync]", msg, e);
    return NextResponse.json(
      {
        error: msg,
        fetched,
        inserted,
        updated,
        linkedExpenses,
        skipped,
        errors,
      },
      { status: 500 }
    );
  }

  const res: Record<string, unknown> = {
    fetched,
    inserted,
    updated,
    linkedExpenses,
    skipped,
    errors,
  };
  if (debug && fetched === 0 && rawResponse) {
    res.rawResponsePreview = rawResponse.slice(0, 1000);
  }
  return NextResponse.json(res);
}
