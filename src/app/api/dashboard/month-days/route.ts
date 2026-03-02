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
  const [year, monthNum] = month.split("-").map(Number);
  const from = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const days = await prisma.day.findMany({
    where: { date: { gte: from, lte: to } },
    include: { revenueLines: true, partyEvents: true },
    orderBy: { date: "asc" },
  });

  const result = days.map((d) => {
    const dayRevenue = d.revenueLines.reduce((s, r) => s + r.total, 0);
    const partyRevenue = d.partyEvents.reduce((s, p) => s + p.total, 0);
    const totalRevenue = dayRevenue + partyRevenue;
    return {
      date: d.date,
      notes: d.notes ?? "",
      isClosed: d.isClosed,
      totalRevenue,
      zPosTotal: d.zPosTotal ?? null,
      zCashTotal: d.zCashTotal ?? null,
      partyCount: d.partyEvents.length,
    };
  });

  return NextResponse.json({ days: result });
}
