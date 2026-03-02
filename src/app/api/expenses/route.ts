import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : null;
    if (!date) {
      return NextResponse.json({ error: "Valid date (YYYY-MM-DD) required" }, { status: 400 });
    }
    const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : null;
    const supplierId = typeof body.supplierId === "string" && body.supplierId ? body.supplierId : null;
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const amount = typeof body.amount === "number" ? body.amount : parseFloat(body.amount);
    const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }

    let finalCategory = category;
    if (supplierId && !category) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (supplier) finalCategory = supplier.defaultCategory;
    }

    const expense = await prisma.expense.create({
      data: {
        date,
        invoiceNumber: invoiceNumber ?? undefined,
        supplierId: supplierId ?? undefined,
        category: finalCategory,
        amount,
        paymentMethod: paymentMethod || "Other",
        notes: notes ?? undefined,
      },
    });
    return NextResponse.json({ id: expense.id, ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
