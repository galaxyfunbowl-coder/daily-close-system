import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = "invoice-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_WIDTH = 1920;
const JPEG_QUALITY = 85;

function getUploadDir(): string {
  const dataDir = path.join(process.cwd(), "data");
  return path.join(dataDir, UPLOAD_DIR);
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { imagePath: true },
    });
    if (!expense?.imagePath) {
      return new NextResponse(null, { status: 404 });
    }
    const fullPath = path.join(process.cwd(), "data", expense.imagePath);
    if (!existsSync(fullPath)) {
      return new NextResponse(null, { status: 404 });
    }
    const buf = await readFile(fullPath);
    const ext = path.extname(expense.imagePath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return new NextResponse(buf, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "File required (field: file)" },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Max size 10 MB" },
        { status: 400 }
      );
    }
    const uploadDir = getUploadDir();
    await mkdir(uploadDir, { recursive: true });
    if (expense.imagePath) {
      const oldPath = path.join(process.cwd(), "data", expense.imagePath);
      if (existsSync(oldPath)) await unlink(oldPath);
    }
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const compressed = await sharp(inputBuffer)
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const filename = buildInvoiceFilename(expense);
    const filePath = path.join(getUploadDir(), filename);
    await writeFile(filePath, compressed);
    const imagePath = `${UPLOAD_DIR}/${filename}`;
    await prisma.expense.update({
      where: { id },
      data: { imagePath },
    });
    return NextResponse.json({ ok: true, imagePath });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const id = (await params).id;
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { imagePath: true },
    });
    if (!expense?.imagePath) {
      return NextResponse.json({ error: "No image" }, { status: 404 });
    }
    const fullPath = path.join(process.cwd(), "data", expense.imagePath);
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }
    await prisma.expense.update({
      where: { id },
      data: { imagePath: null },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
