/**
 * One-time script: move invoice files from invoice-images/ (flat) or invoices/ (flat)
 * to invoices/YYYY/MM-YYYY/ structure.
 *
 * Run: npx tsx scripts/migrate-invoices-to-date-folders.ts
 */

import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

const OLD_DIR = "invoice-images";
const NEW_DIR = "invoices";

/** Returns YYYY/MM-YYYY from date (e.g. 2026-03-03 -> 2026/03-2026) */
function getDateSubfolder(date: string): string {
  const year = date.slice(0, 4);
  const month = date.slice(5, 7) + "-" + year;
  return `${year}/${month}`;
}

async function main(): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  const oldUploadDir = path.join(dataDir, OLD_DIR);

  if (!existsSync(oldUploadDir)) {
    console.log("No invoice-images folder found. Nothing to do.");
    return;
  }

  const expenses = await prisma.expense.findMany({
    where: { imagePath: { not: null } },
    select: { id: true, date: true, imagePath: true },
  });

  const withOldPath = expenses.filter(
    (e): e is typeof e & { imagePath: string } =>
      e.imagePath !== null &&
      (e.imagePath.startsWith(`${OLD_DIR}/`) || e.imagePath.startsWith(`${NEW_DIR}/`))
  );

  const inFlatFolder = withOldPath.filter((e) => {
    const parts = e.imagePath.split("/");
    return parts.length === 2;
  });

  if (inFlatFolder.length === 0) {
    console.log("No files in flat structure. Nothing to do.");
    return;
  }

  console.log(`Found ${inFlatFolder.length} file(s) to move to date folders.\n`);

  let ok = 0;
  let err = 0;

  for (const expense of inFlatFolder) {
    const oldFullPath = path.join(dataDir, expense.imagePath);
    if (!existsSync(oldFullPath)) {
      console.log(`Skip (file missing): ${expense.imagePath}`);
      err++;
      continue;
    }

    const subfolder = getDateSubfolder(expense.date);
    const filename = path.basename(expense.imagePath);
    const newImagePath = `${NEW_DIR}/${subfolder}/${filename}`;
    const newFullPath = path.join(dataDir, newImagePath);
    const newDir = path.dirname(newFullPath);

    try {
      await mkdir(newDir, { recursive: true });
      const buf = await readFile(oldFullPath);
      await writeFile(newFullPath, buf);
      await prisma.expense.update({
        where: { id: expense.id },
        data: { imagePath: newImagePath },
      });
      await unlink(oldFullPath);
      console.log(`OK: ${expense.imagePath} -> ${newImagePath}`);
      ok++;
    } catch (e) {
      console.error(`FAIL: ${expense.imagePath}`, e);
      err++;
    }
  }

  if (ok > 0) {
    const remaining = await readdir(oldUploadDir).catch(() => []);
    if (remaining.length === 0) {
      const { rmdir } = await import("fs/promises");
      await rmdir(oldUploadDir).catch(() => {});
      console.log("\nRemoved empty invoice-images folder.");
    }
  }

  console.log(`\nDone. Moved ${ok}, failed ${err}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
