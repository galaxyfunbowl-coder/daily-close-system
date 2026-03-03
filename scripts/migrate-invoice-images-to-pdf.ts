/**
 * One-time script: convert existing invoice images (jpg, png, webp) to PDF.
 *
 * Run: npx tsx scripts/migrate-invoice-images-to-pdf.ts
 */

import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { convertImageToPdf } from "../src/lib/image-to-pdf";

const UPLOAD_DIR = "invoice-images";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

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
  return `${safe} - ${expense.id}.pdf`;
}

function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(`Unsupported extension: ${ext}`);
  }
}

function isImagePath(imagePath: string): boolean {
  const ext = path.extname(imagePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

async function main(): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  const uploadDir = path.join(dataDir, UPLOAD_DIR);

  if (!existsSync(uploadDir)) {
    console.log("No invoice-images folder found. Nothing to do.");
    return;
  }

  const expenses = await prisma.expense.findMany({
    where: {
      imagePath: { not: null },
    },
    include: { supplier: true },
  });

  const toConvert = expenses.filter(
    (e): e is typeof e & { imagePath: string } =>
      e.imagePath !== null && isImagePath(e.imagePath)
  );

  if (toConvert.length === 0) {
    console.log("No image files to convert. All invoice attachments are already PDF or none exist.");
    return;
  }

  console.log(`Found ${toConvert.length} image(s) to convert to PDF.\n`);

  let ok = 0;
  let err = 0;

  for (const expense of toConvert) {
    const oldPath = path.join(dataDir, expense.imagePath);
    if (!existsSync(oldPath)) {
      console.log(`Skip (file missing): ${expense.imagePath}`);
      err++;
      continue;
    }

    const ext = path.extname(expense.imagePath).toLowerCase();
    const newFilename = buildInvoiceFilename(expense);
    const newPath = path.join(uploadDir, newFilename);
    const newImagePath = `${UPLOAD_DIR}/${newFilename}`;

    try {
      const buffer = await readFile(oldPath);
      const mimeType = getMimeType(ext);
      const pdfBuffer = await convertImageToPdf(buffer, mimeType);
      await writeFile(newPath, pdfBuffer);
      await prisma.expense.update({
        where: { id: expense.id },
        data: { imagePath: newImagePath },
      });
      await unlink(oldPath);
      console.log(`OK: ${expense.imagePath} -> ${newFilename}`);
      ok++;
    } catch (e) {
      console.error(`FAIL: ${expense.imagePath}`, e);
      err++;
    }
  }

  console.log(`\nDone. Converted ${ok}, failed ${err}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
