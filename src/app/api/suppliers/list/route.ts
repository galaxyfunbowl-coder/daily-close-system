import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      expenses: {
        select: { amount: true, date: true },
      },
    },
  });

  const result = suppliers.map((s) => {
    const totalAmount = s.expenses.reduce((sum, e) => sum + e.amount, 0);
    const dates = s.expenses.map((e) => e.date).filter(Boolean).sort();
    return {
      id: s.id,
      name: s.name,
      vatNumber: s.vatNumber,
      defaultCategory: s.defaultCategory,
      _count: { expenses: s.expenses.length },
      _sum: { amount: totalAmount },
      lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  });

  return NextResponse.json(result);
}
