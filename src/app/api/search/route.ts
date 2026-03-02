import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  const q = request.nextUrl.searchParams.get("q");
  const term = typeof q === "string" ? q.trim() : "";
  if (!term || term.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [daysByNotes, linesByInfo] = await Promise.all([
    prisma.day.findMany({
      where: { notes: { not: null, contains: term } },
      select: { date: true, notes: true },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.revenueLine.findMany({
      where: { subLabelInfo: { not: null, contains: term } },
      select: { dayId: true, subLabel: true, subLabelInfo: true, day: { select: { date: true } } },
      orderBy: { day: { date: "desc" } },
      take: 50,
    }),
  ]);

  const byDate = new Map<
    string,
    { date: string; snippets: string[] }
  >();

  for (const d of daysByNotes) {
    if (!d.notes) continue;
    const existing = byDate.get(d.date);
    const snippet = d.notes.length > 80 ? d.notes.slice(0, 80) + "…" : d.notes;
    if (existing) existing.snippets.push(`Ημέρα: ${snippet}`);
    else byDate.set(d.date, { date: d.date, snippets: [`Ημέρα: ${snippet}`] });
  }

  for (const r of linesByInfo) {
    const date = r.day.date;
    const info = r.subLabelInfo ?? "";
    const snippet = info.length > 60 ? info.slice(0, 60) + "…" : info;
    const label = r.subLabel ? `${r.subLabel} — ${snippet}` : snippet;
    const existing = byDate.get(date);
    if (existing) existing.snippets.push(label);
    else byDate.set(date, { date, snippets: [label] });
  }

  const results = Array.from(byDate.entries())
    .map(([date, { snippets }]) => ({ date, snippets }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return NextResponse.json({ results });
}
