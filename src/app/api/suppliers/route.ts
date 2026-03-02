import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;
  const list = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(list);
}
