import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { requestMyExpenses } from "@/lib/mydata/client";
import { parseMyExpensesResponse, type NormalizedMyDataExpense } from "@/lib/mydata/parser";

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

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const hasCredentials = Boolean(
    process.env.MYDATA_USER_ID && process.env.MYDATA_SUBSCRIPTION_KEY
  );
  return NextResponse.json({
    ok: true,
    ready: hasCredentials,
    message: hasCredentials ? "myDATA API reachable" : "Credentials missing",
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

  try {
    const body = (await request.json()) as {
      dateFrom?: string;
      dateTo?: string;
      dryRun?: boolean;
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
  } catch {
    dateFrom = todayISO();
    dateTo = todayISO();
  }

  const errors: { mark?: string; message: string }[] = [];
  let fetched = 0;
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
    const xmlText = await requestMyExpenses(dateFrom, dateTo);
    const normalized = parseMyExpensesResponse(xmlText);
    fetched = normalized.length;

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
                category: existing.expense.category || "Uncategorized",
                notes: description,
              },
            });
          }
        } else {
          await prisma.expense.create({
            data: {
              date: issueDate,
              invoiceNumber: n.aa ?? n.series ?? null,
              category: "Uncategorized",
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
            invoiceNumber: n.aa ?? n.series ?? null,
            category: "Uncategorized",
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

  return NextResponse.json({
    fetched,
    inserted,
    updated,
    linkedExpenses,
    skipped,
    errors,
  });
}
