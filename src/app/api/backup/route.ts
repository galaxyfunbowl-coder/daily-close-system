import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/require-auth";

export async function POST() {
  const auth = await requireAuth();
  if (auth) return auth;
  try {
    const dbPath = path.join(process.cwd(), "data", "app.db");
    const backupsDir = path.join(process.cwd(), "backups");
    await mkdir(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = path.join(backupsDir, `app-${timestamp}.db`);
    const data = await readFile(dbPath);
    await writeFile(backupPath, data);
    return NextResponse.json({ ok: true, path: backupPath });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
