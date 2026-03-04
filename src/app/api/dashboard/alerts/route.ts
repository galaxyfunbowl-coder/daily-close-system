import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

type Alert = { type: "warning" | "info"; message: string };

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;

  const alerts: Alert[] = [];
  const today = todayISO();

  const thisWeekRevenue = await prisma.day.findMany({
    where: { date: { gte: daysAgo(7), lte: today } },
    include: { revenueLines: true, partyEvents: true },
  });
  const lastWeekRevenue = await prisma.day.findMany({
    where: { date: { gte: daysAgo(14), lt: daysAgo(7) } },
    include: { revenueLines: true, partyEvents: true },
  });

  const sumRevenue = (days: typeof thisWeekRevenue) =>
    days.reduce((s, d) => s + d.revenueLines.reduce((a, r) => a + r.total, 0) + d.partyEvents.reduce((a, p) => a + p.total, 0), 0);

  const thisWeek = sumRevenue(thisWeekRevenue);
  const lastWeek = sumRevenue(lastWeekRevenue);

  if (lastWeek > 0 && thisWeek < lastWeek * 0.7) {
    const drop = Math.round((1 - thisWeek / lastWeek) * 100);
    alerts.push({ type: "warning", message: `Πτώση εσόδων ${drop}% σε σχέση με προηγούμενη εβδομάδα` });
  }

  const thisMonthStart = today.slice(0, 7) + "-01";
  const recentExpenses = await prisma.expense.findMany({
    where: { date: { gte: daysAgo(7), lte: today } },
  });
  const prevWeekExpenses = await prisma.expense.findMany({
    where: { date: { gte: daysAgo(14), lt: daysAgo(7) } },
  });
  const thisWeekExp = recentExpenses.reduce((s, e) => s + e.amount, 0);
  const lastWeekExp = prevWeekExpenses.reduce((s, e) => s + e.amount, 0);

  if (lastWeekExp > 0 && thisWeekExp > lastWeekExp * 1.5) {
    const spike = Math.round((thisWeekExp / lastWeekExp - 1) * 100);
    alerts.push({ type: "warning", message: `Αύξηση εξόδων ${spike}% σε σχέση με προηγούμενη εβδομάδα` });
  }

  const missingPdf = await prisma.expense.count({
    where: {
      source: "MYDATA",
      imagePath: null,
      date: { gte: thisMonthStart },
    },
  });
  if (missingPdf > 0) {
    alerts.push({ type: "info", message: `${missingPdf} τιμολόγια myDATA χωρίς PDF αυτόν τον μήνα` });
  }

  return NextResponse.json(alerts);
}
