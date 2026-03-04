import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stats = await prisma.expense.aggregate({
    where: { supplierId: id },
    _sum: { amount: true },
    _count: true,
    _avg: { amount: true },
    _min: { date: true },
    _max: { date: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { supplierId: id },
    orderBy: { date: "desc" },
    take: 100,
    select: {
      id: true,
      date: true,
      invoiceNumber: true,
      amount: true,
      category: true,
      paymentMethod: true,
      notes: true,
      imagePath: true,
      source: true,
    },
  });

  return NextResponse.json({
    supplier,
    stats: {
      totalExpenses: stats._sum.amount ?? 0,
      invoiceCount: stats._count,
      averageInvoice: stats._avg.amount ?? 0,
      firstInvoiceDate: stats._min.date,
      lastInvoiceDate: stats._max.date,
    },
    expenses,
  });
}
