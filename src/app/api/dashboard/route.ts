import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { Department } from "@prisma/client";

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
    include: {
      revenueLines: { include: { staff: true } },
      partyEvents: { include: { staff: true } },
    },
  });

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: from, lte: to } },
  });

  const payrollRows = await prisma.staffMonthlySalary.findMany({
    where: { month },
  });
  const payrollTotal = payrollRows.reduce((s, r) => s + r.amount, 0);

  let totalRevenue = 0;
  let totalPOS = 0;
  let totalCash = 0;
  let partyRevenue = 0;
  let partyCount = 0;
  const bowlingBySubLabel: Record<string, number> = {};
  const electronicByOperator: Record<string, number> = {};
  let playgroundTotal = 0;
  let billiardsTotal = 0;
  let barTotal = 0;
  let serviceTotal = 0;
  let proshopTotal = 0;

  for (const day of days) {
    const dayRevenue = day.revenueLines.reduce((s, r) => s + r.total, 0);
    const dayPartyRevenue = day.partyEvents.reduce((s, p) => s + p.total, 0);

    totalRevenue += dayRevenue + dayPartyRevenue;
    totalPOS += day.zPosTotal ?? 0;
    totalCash += day.zCashTotal ?? 0;
    partyRevenue += dayPartyRevenue;
    partyCount += day.partyEvents.length;

    for (const r of day.revenueLines) {
      if (r.department === Department.RECEPTION_BOWLING) {
        const key = r.subLabel ?? "Regular";
        bowlingBySubLabel[key] = (bowlingBySubLabel[key] ?? 0) + r.total;
      } else if (r.department === Department.ELECTRONIC_GAMES && r.operator) {
        const key = r.operator;
        electronicByOperator[key] = (electronicByOperator[key] ?? 0) + r.total;
      } else if (r.department === Department.PAIDOTOPOS) {
        playgroundTotal += r.total;
      } else if (r.department === Department.BILIARDA) {
        billiardsTotal += r.total;
      } else if (r.department === Department.BAR) {
        barTotal += r.total;
      } else if (r.department === Department.SERVICE) {
        serviceTotal += r.total;
      } else if ((r.department as string) === "PROSHOP") {
        proshopTotal += r.total;
      }
    }
  }

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenseTotal + payrollTotal;
  const netResult = totalRevenue - totalExpenses;

  const prevYear = year - 1;
  const prevFrom = `${prevYear}-${String(monthNum).padStart(2, "0")}-01`;
  const prevLastDay = new Date(prevYear, monthNum, 0).getDate();
  const prevTo = `${prevYear}-${String(monthNum).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;

  const prevDays = await prisma.day.findMany({
    where: { date: { gte: prevFrom, lte: prevTo } },
    include: { revenueLines: true, partyEvents: true },
  });

  let prevRevenue = 0;
  let prevExpenses = 0;
  let prevPartyRevenue = 0;
  for (const day of prevDays) {
    prevRevenue += day.revenueLines.reduce((s, r) => s + r.total, 0) +
      day.partyEvents.reduce((s, p) => s + p.total, 0);
    prevPartyRevenue += day.partyEvents.reduce((s, p) => s + p.total, 0);
  }
  const prevExpenseRows = await prisma.expense.findMany({
    where: { date: { gte: prevFrom, lte: prevTo } },
  });
  prevExpenses = prevExpenseRows.reduce((s, e) => s + e.amount, 0);
  const prevNet = prevRevenue - prevExpenses;

  return NextResponse.json({
    month,
    totalRevenue,
    totalExpenses,
    payrollTotal,
    netResult,
    totalPOS,
    totalCash,
    partyRevenue,
    partyCount,
    bowlingBySubLabel,
    electronicByOperator,
    playgroundTotal,
    billiardsTotal,
    barTotal,
    serviceTotal,
    proshopTotal,
    yoy: {
      revenue: prevRevenue,
      expenses: prevExpenses,
      net: prevNet,
      partyRevenue: prevPartyRevenue,
    },
  });
}
