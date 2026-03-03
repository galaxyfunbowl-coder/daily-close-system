/**
 * One-time script: rename existing invoice images from {id}.jpg
 * to {Date} - {Supplier} - {Notes} - {id}.jpg
 *
 * Run: npx tsx scripts/rename-invoice-images.ts
 */

import { readdir, rename } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

const UPLOAD_DIR = "invoice-images";

function sanitizeFilename(s: string, maxLen: number): string {
  const cleaned = s
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function buildInvoiceFilename(expense: {
  date: string;
  supplier?: { name: string } | null;
  notes: string | null;
  id: string;
}): string {
  const date = expense.date;
  const supplier = sanitizeFilename(expense.supplier?.name ?? "—", 50);
  const notes = sanitizeFilename(expense.notes ?? "", 60);
  const base = `${date} - ${supplier} - ${notes}`.trim();
  const safe = base || expense.id;
  return `${safe} - ${expense.id}.jpg`;
}

function isOldFormat(filename: string): boolean {
  if (!filename.endsWith(".jpg")) return false;
  const base = filename.slice(0, -4);
  return !base.includes(" - ");
}

async function main(): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  const uploadDir = path.join(dataDir, UPLOAD_DIR);

  if (!existsSync(uploadDir)) {
    console.log("No invoice-images folder found. Nothing to do.");
    return;
  }

  const files = await readdir(uploadDir);
  const jpgFiles = files.filter((f) => f.toLowerCase().endsWith(".jpg"));

  let count = 0;
  for (const oldFilename of jpgFiles) {
    if (!isOldFormat(oldFilename)) {
      console.log(`Skip (already new format): ${oldFilename}`);
      continue;
    }

    const expenseId = oldFilename.slice(0, -4);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { supplier: true },
    });

    if (!expense) {
      console.log(`Warning: no expense found for ${expenseId}, skipping`);
      continue;
    }

    const newFilename = buildInvoiceFilename(expense);
    if (newFilename === oldFilename) continue;

    const oldPath = path.join(uploadDir, oldFilename);
    const newPath = path.join(uploadDir, newFilename);

    if (existsSync(newPath)) {
      console.log(`Warning: target exists, skipping: ${newFilename}`);
      continue;
    }

    await rename(oldPath, newPath);
    await prisma.expense.update({
      where: { id: expenseId },
      data: { imagePath: `${UPLOAD_DIR}/${newFilename}` },
    });
    console.log(`${oldFilename} -> ${newFilename}`);
    count++;
  }

  console.log(`\nDone. Renamed ${count} file(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
