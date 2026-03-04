import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { getNextXtNumber } from "@/lib/next-xt-number";
import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const CreateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  invoiceNumber: z.string().optional().nullable(),
  noInvoice: z.boolean().optional(),
  supplierId: z.string().optional().nullable(),
  category: z.string().optional().default(""),
  amount: z.union([z.number(), z.string().transform(Number)]).pipe(z.number({ message: "Valid amount required" })),
  paymentMethod: z.string().optional().default("Μετρητά"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from && !DATE_REGEX.test(from)) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }
  if (to && !DATE_REGEX.test(to)) {
    return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
  }

  const where: { date?: { gte?: string; lte?: string } } = {};
  if (from) where.date = { ...where.date, gte: from };
  if (to) where.date = { ...where.date, lte: to };

  const expenses = await prisma.expense.findMany({
    where,
    include: { supplier: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    expenses.map((e) => ({
      id: e.id,
      date: e.date,
      invoiceNumber: e.invoiceNumber ?? "",
      supplierId: e.supplierId ?? null,
      supplierName: e.supplier?.name ?? null,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      notes: e.notes ?? "",
      imagePath: e.imagePath ?? null,
      source: e.source ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const raw = await request.json();
    const parsed = CreateExpenseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const body = parsed.data;

    let invoiceNumber: string | null = body.invoiceNumber?.trim() || null;
    if (body.noInvoice === true && !invoiceNumber) {
      invoiceNumber = await getNextXtNumber();
    }
    const supplierId = body.supplierId || null;

    let finalCategory = body.category;
    if (supplierId && !finalCategory) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (supplier) finalCategory = supplier.defaultCategory;
    }

    const expense = await prisma.expense.create({
      data: {
        date: body.date,
        invoiceNumber: invoiceNumber ?? undefined,
        supplierId: supplierId ?? undefined,
        category: finalCategory || "Λοιπά",
        amount: body.amount,
        paymentMethod: body.paymentMethod || "Μετρητά",
        notes: body.notes?.trim() ?? undefined,
      },
    });
    return NextResponse.json({ id: expense.id, ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
