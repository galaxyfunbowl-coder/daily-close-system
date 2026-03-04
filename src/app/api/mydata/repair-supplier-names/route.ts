import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  requestDocs,
  parseIssuerNamesFromRequestDocs,
  requestReceiverInfo,
  parseReceiverInfoCompanyName,
} from "@/lib/mydata/client";
import { getMyDataCredentials } from "@/lib/mydata/credentials";

const FALLBACK_PATTERN = /^Προμηθευτής\s+(\d{8,9})$/;

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

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

  const issuerNames = new Map<string, string>();
  try {
    const dateFrom = monthsAgo(12);
    const dateTo = new Date().toISOString().slice(0, 10);
    const docsText = await requestDocs(dateFrom, dateTo, creds);
    const parsed = parseIssuerNamesFromRequestDocs(docsText);
    for (const [vat, name] of parsed) {
      if (vat && name) issuerNames.set(vat.replace(/\D/g, ""), name);
    }
  } catch {
    // Continue without RequestDocs names
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
    const vatNorm = vat.replace(/\D/g, "").replace(/^0+/, "") || vat;
    const vatPadded = vatNorm.length === 8 ? `0${vatNorm}` : vatNorm;
    let name =
      issuerNames.get(vatNorm) ??
      issuerNames.get(vatPadded) ??
      issuerNames.get(vat);
    if (!name) {
      try {
        const resp = await requestReceiverInfo(vat, creds);
        name = parseReceiverInfoCompanyName(resp) ?? undefined;
      } catch (e) {
        failed.push({
          vatNumber: vat,
          error: e instanceof Error ? e.message : "Unknown error",
        });
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    }
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
    } else if (!name) {
      failed.push({
        vatNumber: vat,
        error: "Δεν βρέθηκε επωνυμία (ούτε από RequestDocs ούτε RequestReceiverInfo)",
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
