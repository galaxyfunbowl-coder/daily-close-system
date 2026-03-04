import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { requestDocsIssuerNames } from "@/lib/mydata/client";
import { getMyDataCredentials } from "@/lib/mydata/credentials";

const FALLBACK_PATTERN = /^Προμηθευτής\s+(\d{8,9})$/;

function normalizeGreekVat(vat: string): string {
  const digits = vat.replace(/\D/g, "");
  return digits.length === 8 ? `0${digits}` : digits.length === 9 ? digits : vat;
}

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
  let requestDocsOk = false;
  let requestDocsError: string | null = null;
  try {
    const dateFrom = monthsAgo(12);
    const dateTo = new Date().toISOString().slice(0, 10);
    const parsed = await requestDocsIssuerNames(dateFrom, dateTo, creds, 31);
    for (const [vat, name] of parsed) {
      if (vat && name) {
        const vatNorm = vat.replace(/\D/g, "");
        if (vatNorm) {
          issuerNames.set(vatNorm, name);
          if (vatNorm.length === 8) issuerNames.set(`0${vatNorm}`, name);
          if (vatNorm.length === 9 && vatNorm.startsWith("0")) issuerNames.set(vatNorm.replace(/^0+/, ""), name);
        }
      }
    }
    requestDocsOk = issuerNames.size > 0;
    if (issuerNames.size === 0) {
      requestDocsError = "Δεν βρέθηκαν επωνυμίες (cryptoKey ή άλλο σφάλμα για το εύρος ημερομηνιών)";
    }
  } catch (e) {
    requestDocsError = e instanceof Error ? e.message : "Unknown error";
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
      failed.push({
        vatNumber: vat,
        error: requestDocsError ?? "RequestDocs 404 ή κενή απάντηση — δεν βρέθηκαν επωνυμίες",
      });
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    if (name && name.trim().length > 1) {
      const vat9 = normalizeGreekVat(vat);
      await prisma.supplier.update({
        where: { id: s.id },
        data: {
          name: name.trim().slice(0, 200),
          vatNumber: vat9,
        },
      });
      updated.push({
        id: s.id,
        vatNumber: vat,
        oldName: s.name,
        newName: name.trim().slice(0, 200),
      });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  for (const s of suppliers) {
    const vat = s.vatNumber ?? "";
    const digits = vat.replace(/\D/g, "");
    if (digits.length === 8) {
      const vat9 = `0${digits}`;
      await prisma.supplier.update({
        where: { id: s.id },
        data: { vatNumber: vat9 },
      });
    }
  }

  const hint =
    !requestDocsOk && failed.length > 0
      ? `RequestDocs: ${requestDocsError ?? "άγνωστο σφάλμα"} — Ενημερώστε χειροκίνητα τα ονόματα από Admin > Προμηθευτές.`
      : null;

  return NextResponse.json({
    repaired: updated.length,
    failedCount: failed.length,
    vatNormalized: suppliers.filter((s) => (s.vatNumber ?? "").replace(/\D/g, "").length === 8).length,
    requestDocsOk,
    requestDocsError,
    hint,
    updated,
    failed,
  });
}
