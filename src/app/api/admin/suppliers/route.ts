import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const list = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const defaultCategory = typeof body.defaultCategory === "string" ? body.defaultCategory.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const supplier = await prisma.supplier.create({
      data: { name, defaultCategory: defaultCategory || "General" },
    });
    return NextResponse.json({ id: supplier.id, ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
