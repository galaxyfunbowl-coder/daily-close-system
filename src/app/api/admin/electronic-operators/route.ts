import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ElectronicOperator } from "@prisma/client";
import { OPERATOR_LABELS, ELECTRONIC_OPERATORS } from "@/lib/constants";

const ALL_OPERATORS: ElectronicOperator[] = ELECTRONIC_OPERATORS;

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;

  // Ensure default configs exist for all enum values
  await prisma.$transaction(async (tx) => {
    for (const op of ALL_OPERATORS) {
      await tx.electronicOperatorConfig.upsert({
        where: { operator: op },
        update: {},
        create: {
          operator: op,
          name: OPERATOR_LABELS[op] ?? op,
          active: true,
        },
      });
    }
  });

  const rows = await prisma.electronicOperatorConfig.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    rows.map((r) => ({
      key: r.operator,
      name: r.name,
      active: r.active,
    }))
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const key = body?.key as ElectronicOperator | undefined;
    if (!key || !ALL_OPERATORS.includes(key)) {
      return NextResponse.json({ error: "Invalid operator key" }, { status: 400 });
    }
    const data: { name?: string; active?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.active === "boolean") data.active = body.active;
    if (!data.name && data.active === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    await prisma.electronicOperatorConfig.update({
      where: { operator: key },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

