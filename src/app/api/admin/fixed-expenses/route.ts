import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 });
  }

  const items = await prisma.fixedMonthlyExpense.findMany({
    where: { month },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    month,
    items: items.map((x) => ({ id: x.id, name: x.name, amount: x.amount })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const amount = typeof body.amount === "number" && body.amount >= 0 ? body.amount : null;

    if (!month || !name || amount == null) {
      return NextResponse.json(
        { error: "month (YYYY-MM), name, amount (>=0) required" },
        { status: 400 }
      );
    }

    const row = await prisma.fixedMonthlyExpense.create({
      data: { month, name, amount },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

