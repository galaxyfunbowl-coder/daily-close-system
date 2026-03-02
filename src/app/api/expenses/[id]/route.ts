import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const body = await request.json();
    const data: {
      date?: string;
      invoiceNumber?: string;
      supplierId?: string | null;
      category?: string;
      amount?: number;
      paymentMethod?: string;
      notes?: string | null;
    } = {};
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) data.date = body.date;
    if (typeof body.invoiceNumber === "string") data.invoiceNumber = body.invoiceNumber.trim();
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null;
    if (typeof body.category === "string") data.category = body.category.trim();
    if (typeof body.amount === "number" && body.amount >= 0) data.amount = body.amount;
    if (typeof body.paymentMethod === "string") data.paymentMethod = body.paymentMethod.trim();
    if (body.notes !== undefined) data.notes = body.notes === "" ? null : body.notes;

    await prisma.expense.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found or invalid data" }, { status: 400 });
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
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { imagePath: true },
    });
    if (expense?.imagePath) {
      const fullPath = path.join(process.cwd(), "data", expense.imagePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }
    }
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
