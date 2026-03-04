import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  requestReceiverInfo,
  parseReceiverInfoCompanyName,
} from "@/lib/mydata/client";
import { getMyDataCredentials } from "@/lib/mydata/credentials";

const FALLBACK_PATTERN = /^Προμηθευτής\s+(\d{8,9})$/;

export const maxDuration = 120;

export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth) return auth;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const creds = await getMyDataCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "myDATA credentials missing." },
      { status: 400 }
    );
  }

  const suppliers = await prisma.supplier.findMany({
    where: { vatNumber: { not: null } },
    select: { id: true, name: true, vatNumber: true },
  });

  const toRepair = suppliers.filter(
    (s) => s.vatNumber && FALLBACK_PATTERN.test(s.name)
  );

  const updated: { id: string; vatNumber: string; oldName: string; newName: string }[] = [];
  const failed: { vatNumber: string; error: string }[] = [];

  for (const s of toRepair) {
    const vat = s.vatNumber ?? "";
    try {
      const resp = await requestReceiverInfo(vat, creds);
      const name = parseReceiverInfoCompanyName(resp);
      if (name && name.trim().length > 1) {
        await prisma.supplier.update({
          where: { id: s.id },
          data: { name: name.trim().slice(0, 200) },
        });
        updated.push({
          id: s.id,
          vatNumber: vat,
          oldName: s.name,
          newName: name.trim().slice(0, 200),
        });
      }
    } catch (e) {
      failed.push({
        vatNumber: vat,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({
    repaired: updated.length,
    failedCount: failed.length,
    updated,
    failed,
  });
}
