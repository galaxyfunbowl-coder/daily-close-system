/**
 * One-time script: compress existing PDF invoice files.
 *
 * Run: npx tsx scripts/compress-existing-pdfs.ts
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { compressPdfBuffer } from "../src/lib/compress-pdf";

async function main(): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");

  const expenses = await prisma.expense.findMany({
    where: {
      imagePath: { not: null },
    },
    select: { id: true, imagePath: true },
  });

  const withPdf = expenses.filter(
    (e): e is typeof e & { imagePath: string } =>
      e.imagePath !== null && e.imagePath.toLowerCase().endsWith(".pdf")
  );

  if (withPdf.length === 0) {
    console.log("No PDF files found. Nothing to do.");
    return;
  }

  console.log(`Found ${withPdf.length} PDF(s) to compress.\n`);

  let compressed = 0;
  let skipped = 0;
  let failed = 0;
  let totalSaved = 0;

  for (const expense of withPdf) {
    const fullPath = path.join(dataDir, expense.imagePath);
    if (!existsSync(fullPath)) {
      console.log(`Skip (missing): ${expense.imagePath}`);
      failed++;
      continue;
    }

    try {
      const buffer = await readFile(fullPath);
      const originalSize = buffer.length;
      const compressedBuffer = await compressPdfBuffer(buffer);
      const newSize = compressedBuffer.length;

      if (newSize < originalSize) {
        await writeFile(fullPath, compressedBuffer);
        const saved = originalSize - newSize;
        totalSaved += saved;
        console.log(`OK: ${expense.imagePath} — ${(originalSize / 1024).toFixed(1)} KB → ${(newSize / 1024).toFixed(1)} KB (saved ${(saved / 1024).toFixed(1)} KB)`);
        compressed++;
      } else {
        console.log(`Skip (no gain): ${expense.imagePath}`);
        skipped++;
      }
    } catch (e) {
      console.error(`FAIL: ${expense.imagePath}`, e);
      failed++;
    }
  }

  console.log(`\nDone. Compressed ${compressed}, skipped ${skipped}, failed ${failed}.`);
  if (totalSaved > 0) {
    console.log(`Total saved: ${(totalSaved / 1024).toFixed(1)} KB`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
