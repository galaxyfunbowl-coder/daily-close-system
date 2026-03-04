import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;

  const body = await request.json();
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";

  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: "targetId and sourceId required and must differ" }, { status: 400 });
  }

  const [target, source] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: targetId } }),
    prisma.supplier.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target) return NextResponse.json({ error: "Target supplier not found" }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Source supplier not found" }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.expense.updateMany({
      where: { supplierId: sourceId },
      data: { supplierId: targetId },
    });
    await tx.supplier.delete({ where: { id: sourceId } });
    return moved.count;
  });

  return NextResponse.json({
    ok: true,
    movedExpenses: result,
    deletedSupplier: source.name,
    targetSupplier: target.name,
  });
}
