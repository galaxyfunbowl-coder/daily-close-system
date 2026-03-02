import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const list = await prisma.closure.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const date = typeof body.date === "string" && DATE_REGEX.test(body.date) ? body.date : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!date || !reason) {
      return NextResponse.json({ error: "Date (YYYY-MM-DD) and reason required" }, { status: 400 });
    }
    const closure = await prisma.closure.create({ data: { date, reason } });
    return NextResponse.json({ id: closure.id, ok: true });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Date already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
