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

  const staff = await prisma.staff.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      monthlySalaries: { where: { month }, take: 1 },
    },
  });

  const list = staff.map((s) => ({
    staffId: s.id,
    staffName: s.name,
    amount: s.monthlySalaries[0]?.amount ?? 0,
  }));

  return NextResponse.json({ month, salaries: list });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
    const salaries = Array.isArray(body.salaries) ? body.salaries : [];
    if (!month) {
      return NextResponse.json({ error: "month (YYYY-MM) required" }, { status: 400 });
    }

    for (const row of salaries) {
      const staffId = typeof row.staffId === "string" ? row.staffId : "";
      const amount = typeof row.amount === "number" && row.amount >= 0 ? row.amount : 0;
      if (!staffId) continue;

      await prisma.staffMonthlySalary.upsert({
        where: {
          staffId_month: { staffId, month },
        },
        create: { staffId, month, amount },
        update: { amount },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
