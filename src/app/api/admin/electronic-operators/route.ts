import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

const DEFAULT_OPERATORS = [
  { name: "Adam Games" },
  { name: "2play Games" },
  { name: "Δικά μου ηλεκτρονικά" },
];

async function ensureDefaults(): Promise<void> {
  const count = await prisma.electronicOperator.count();
  if (count === 0) {
    await prisma.electronicOperator.createMany({
      data: DEFAULT_OPERATORS.map((o) => ({ name: o.name, active: true })),
    });
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  await ensureDefaults();
  const rows = await prisma.electronicOperator.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, name: r.name, active: r.active }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }
    const created = await prisma.electronicOperator.create({
      data: { name, active: true },
    });
    return NextResponse.json({
      id: created.id,
      name: created.name,
      active: created.active,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const data: { name?: string; active?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim())
      data.name = body.name.trim();
    if (typeof body.active === "boolean") data.active = body.active;
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }
    await prisma.electronicOperator.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  try {
    await prisma.electronicOperator.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Operator not found or in use" },
      { status: 404 }
    );
  }
}
