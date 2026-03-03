/**
 * Convert image buffer (JPEG, PNG, WebP) to PDF for unified storage.
 */

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 72;

export async function convertImageToPdf(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width ?? 1280;
  const height = meta.height ?? 720;

  let imageBuffer: Buffer;
  if (mimeType === "image/jpeg") {
    imageBuffer = await img
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } else if (mimeType === "image/png" || mimeType === "image/webp") {
    imageBuffer = await img
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } else {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  const resized = sharp(imageBuffer);
  const resizedMeta = await resized.metadata();
  const pageWidth = resizedMeta.width ?? width;
  const pageHeight = resizedMeta.height ?? height;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const embedded = await pdfDoc.embedJpg(imageBuffer);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
