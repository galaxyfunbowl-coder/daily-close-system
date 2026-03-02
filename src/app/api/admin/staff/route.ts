import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { StaffRole } from "@prisma/client";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const list = await prisma.staff.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(
    list.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      active: s.active,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const role = body.role === "ADMIN" ? StaffRole.ADMIN : StaffRole.SERVER;
    const staff = await prisma.staff.create({
      data: { name, role },
    });
    return NextResponse.json({ id: staff.id, ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
