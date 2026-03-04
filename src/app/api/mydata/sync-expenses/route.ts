import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  requestMyExpenses,
  requestDocsEnriched,
} from "@/lib/mydata/client";
import { parseMyExpensesResponse, type NormalizedMyDataExpense } from "@/lib/mydata/parser";
import { getMyDataCredentials } from "@/lib/mydata/credentials";
import { normalizeGreekVat, todayISO, buildInvoiceNumber, DATE_REGEX } from "@/lib/mydata/utils";

export const maxDuration = 60;

async function getLastMark(): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "main" },
    select: { lastMyDataMark: true },
  });
  return settings?.lastMyDataMark ?? null;
}

async function saveLastMark(mark: string): Promise<void> {
  await prisma.companySettings.upsert({
    where: { id: "main" },
    update: { lastMyDataMark: mark },
    create: { id: "main", lastMyDataMark: mark },
  });
}

function fallbackUniqueKey(n: NormalizedMyDataExpense): string {
  return [
    n.issuerVat ?? "",
    n.issueDate ?? "",
    String(n.totalAmount ?? 0),
    n.invoiceType ?? "",
    n.aa ?? "",
  ].join("|");
}

function isFallbackName(name: string, vat: string): boolean {
  const vat9 = normalizeGreekVat(vat);
  return name === `Προμηθευτής ${vat}` || name === `Προμηθευτής ${vat9}`;
}

async function findOrCreateSupplier(
  issuerVat: string | undefined,
  issuerName: string | undefined,
  nameCache: Map<string, string>
): Promise<{ id: string; defaultCategory: string } | null> {
  if (!issuerVat && !issuerName) return null;
  const vatRaw = issuerVat?.trim() ?? "";
  const vat = normalizeGreekVat(vatRaw);

  let name = issuerName?.trim() || undefined;
  if (!name && vat) {
    const digits = vat.replace(/\D/g, "");
    name = nameCache.get(digits)
      ?? nameCache.get(digits.padStart(9, "0"))
      ?? nameCache.get(digits.replace(/^0+/, ""));
  }
  const fallbackName = vat ? `Προμηθευτής ${vat}` : "Άγνωστος προμηθευτής";
  name = (name || fallbackName).slice(0, 200);

  if (vat) {
    const existing = await prisma.supplier.findUnique({
      where: { vatNumber: vat },
      select: { id: true, defaultCategory: true, name: true },
    });
    if (existing) {
      if (name !== fallbackName && isFallbackName(existing.name, vat)) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return { id: existing.id, defaultCategory: existing.defaultCategory };
    }
  }

  const created = await prisma.supplier.create({
    data: { name, defaultCategory: "Λοιπά", vatNumber: vat || undefined },
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

  if (dryRun) {
    return NextResponse.json({
      fetched: 0, inserted: 0, updated: 0, linkedExpenses: 0, skipped: 0, errors: [],
      message: "Dry run – AADE not called",
    });
  }

  const errors: { mark?: string; message: string }[] = [];
  let fetched = 0;
  let rawResponse = "";
  let inserted = 0;
  let updated = 0;
  let linkedExpenses = 0;
  let skipped = 0;

  try {
    const creds = await getMyDataCredentials();
    if (!creds) {
      return NextResponse.json(
        { error: "myDATA credentials missing. Set MYDATA_USER_ID and MYDATA_SUBSCRIPTION_KEY in .env.local or CompanySettings." },
        { status: 400 }
      );
    }

    const xmlText = await requestMyExpenses(dateFrom, dateTo, creds);
    rawResponse = xmlText;
    const allNormalized = parseMyExpensesResponse(xmlText);

    const lastMark = await getLastMark();
    const normalized = lastMark
      ? allNormalized.filter((n) => n.mark > lastMark)
      : allNormalized;
    fetched = normalized.length;

    if (fetched === 0) {
      const res: Record<string, unknown> = {
        fetched: 0, inserted: 0, updated: 0, linkedExpenses: 0, skipped: 0, errors: [],
        totalFromApi: allNormalized.length,
        lastMark,
      };
      if (debug && rawResponse) res.rawResponsePreview = rawResponse.slice(0, 1000);
      return NextResponse.json(res);
    }

    const nameCache = new Map<string, string>();
    const urlsByMark = new Map<string, string>();
    try {
      const docsResult = await requestDocsEnriched(dateFrom, dateTo, creds, 31);
      for (const [vat, name] of docsResult.issuerNames) {
        if (vat && name) {
          const vatNorm = vat.replace(/\D/g, "");
          if (vatNorm) {
            nameCache.set(vatNorm, name);
            if (vatNorm.length === 8) nameCache.set(`0${vatNorm}`, name);
            if (vatNorm.length === 9 && vatNorm.startsWith("0")) nameCache.set(vatNorm.replace(/^0+/, ""), name);
          }
        }
      }
      for (const [mk, url] of docsResult.urlsByMark) urlsByMark.set(mk, url);
    } catch {
      // RequestDocs not critical
    }

    const allMarks = normalized.map((n) => n.mark).filter(Boolean);
    const existingMyData = await prisma.myDataExpense.findMany({
      where: { mark: { in: allMarks } },
      include: { expense: true },
    });
    const existingByMark = new Map(existingMyData.map((e) => [e.mark, e]));

    let highestMark = lastMark ?? "";

    for (const n of normalized) {
      const pk = n.mark || fallbackUniqueKey(n);
      if (!pk) {
        skipped++;
        errors.push({ message: "Missing mark and fallback key" });
        continue;
      }

      if (n.mark && n.mark > highestMark) highestMark = n.mark;

      const issueDate = n.issueDate ?? todayISO();
      const totalAmount = n.totalAmount ?? 0;
      const invoiceNumber = buildInvoiceNumber(n.series, n.aa);

      const supplierMatch = await findOrCreateSupplier(n.issuerVat, n.issuerName, nameCache);
      const supplierId = supplierMatch?.id ?? null;
      const category = supplierMatch?.defaultCategory ?? "Λοιπά";

      const sourceRaw = n.rawSnippet ? JSON.stringify(n.rawSnippet) : null;
      const invoiceUrl = urlsByMark.get(n.mark) ?? undefined;
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
        downloadingInvoiceUrl: invoiceUrl,
      };

      const existing = existingByMark.get(n.mark);

      if (existing) {
        await prisma.$transaction(async (tx) => {
          const myDataExpense = await tx.myDataExpense.update({
            where: { mark: n.mark },
            data: myDataData,
          });
          updated++;

          if (existing.expense) {
            linkedExpenses++;
            if (existing.expense.source === "MYDATA" && !existing.expense.userEdited) {
              await tx.expense.update({
                where: { id: existing.expense.id },
                data: {
                  date: issueDate,
                  amount: totalAmount,
                  category: existing.expense.category || category,
                  supplierId: supplierId ?? existing.expense.supplierId,
                  invoiceNumber: invoiceNumber ?? existing.expense.invoiceNumber,
                },
              });
            }
          } else {
            await tx.expense.create({
              data: {
                date: issueDate,
                invoiceNumber,
                supplierId,
                category,
                amount: totalAmount,
                paymentMethod: "Τραπεζική μεταφορά",
                notes: "",
                source: "MYDATA",
                userEdited: false,
                myDataExpenseId: myDataExpense.id,
              },
            });
            linkedExpenses++;
          }
        });
      } else {
        await prisma.$transaction(async (tx) => {
          const myDataExpense = await tx.myDataExpense.create({ data: myDataData });
          inserted++;
          await tx.expense.create({
            data: {
              date: issueDate,
              invoiceNumber,
              supplierId,
              category,
              amount: totalAmount,
              paymentMethod: "Τραπεζική μεταφορά",
              notes: "",
              source: "MYDATA",
              userEdited: false,
              myDataExpenseId: myDataExpense.id,
            },
          });
          linkedExpenses++;
        });
      }
    }

    if (highestMark) {
      await saveLastMark(highestMark);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("[mydata sync]", msg, e);
    return NextResponse.json(
      { error: msg, fetched, inserted, updated, linkedExpenses, skipped, errors },
      { status: 500 }
    );
  }

  const res: Record<string, unknown> = {
    fetched, inserted, updated, linkedExpenses, skipped, errors,
  };
  if (debug && fetched === 0 && rawResponse) {
    res.rawResponsePreview = rawResponse.slice(0, 1000);
  }
  return NextResponse.json(res);
}
