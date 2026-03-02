import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { StaffRole } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const body = await request.json();
    const data: { name?: string; role?: StaffRole; active?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.role === "ADMIN" || body.role === "SERVER") data.role = body.role;
    if (typeof body.active === "boolean") data.active = body.active;
    await prisma.staff.update({ where: { id }, data });
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
    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Foreign key") || msg.includes("partyEvents") || msg.includes("PartyEvent")) {
      return NextResponse.json(
        { error: "Δεν μπορεί να διαγραφεί: υπάρχουν ημέρες/πάρτυ που το χρησιμοποιούν." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
