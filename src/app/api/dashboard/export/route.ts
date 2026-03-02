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
    include: { revenueLines: { include: { staff: true } }, partyEvents: { include: { staff: true } } },
  });

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: from, lte: to } },
    include: { supplier: true },
  });

  const escape = (s: string | number): string => {
    const t = String(s);
    if (t.includes(",") || t.includes('"') || t.includes("\n")) {
      return `"${t.replace(/"/g, '""')}"`;
    }
    return t;
  };

  const rows: string[] = [];
  rows.push("date,department,sublabel,staff,total,pos,cash,notes");
  for (const day of days) {
    for (const r of day.revenueLines) {
      rows.push([
        day.date,
        r.department,
        r.subLabel ?? "",
        r.staff?.name ?? "",
        r.total,
        r.pos,
        r.cash,
        "",
      ].map(escape).join(","));
    }
    for (const p of day.partyEvents) {
      rows.push([
        day.date,
        "PARTY",
        "",
        p.staff.name,
        p.total,
        p.posComputed,
        p.cashComputed,
        p.notes ?? "",
      ].map(escape).join(","));
    }
  }
  rows.push("");
  rows.push("Expenses");
  rows.push("date,invoiceNumber,supplier,category,amount,paymentMethod,notes");
  for (const e of expenses) {
    rows.push([
      e.date,
      e.invoiceNumber ?? "",
      e.supplier?.name ?? "",
      e.category,
      e.amount,
      e.paymentMethod,
      e.notes ?? "",
    ].map(escape).join(","));
  }

  const csv = "\uFEFF" + rows.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${month}.csv"`,
    },
  });
}
