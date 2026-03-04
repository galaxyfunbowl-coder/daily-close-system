import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const body = await request.json();
    const data: { name?: string; defaultCategory?: string; vatNumber?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.defaultCategory === "string") data.defaultCategory = body.defaultCategory.trim();
    if (body.vatNumber !== undefined) {
      data.vatNumber = typeof body.vatNumber === "string" && body.vatNumber.trim() ? body.vatNumber.trim() : null;
    }
    if (data.vatNumber) {
      const existing = await prisma.supplier.findUnique({ where: { vatNumber: data.vatNumber } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: `ΑΦΜ ${data.vatNumber} ήδη υπάρχει (${existing.name})` }, { status: 409 });
      }
    }
    await prisma.supplier.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
