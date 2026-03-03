/**
 * Convert image buffer (JPEG, PNG, WebP) to PDF for unified storage.
 */

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const MAX_WIDTH = 1920;
const JPEG_QUALITY = 85;

export async function convertImageToPdf(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width ?? 1920;
  const height = meta.height ?? 1080;

  let imageBuffer: Buffer;
  let embedFn: "embedJpg" | "embedPng";

  if (mimeType === "image/jpeg") {
    imageBuffer = await img
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    embedFn = "embedJpg";
  } else if (mimeType === "image/png") {
    imageBuffer = await img
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .png()
      .toBuffer();
    embedFn = "embedPng";
  } else if (mimeType === "image/webp") {
    imageBuffer = await img
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      .png()
      .toBuffer();
    embedFn = "embedPng";
  } else {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  const resized = sharp(imageBuffer);
  const resizedMeta = await resized.metadata();
  const pageWidth = resizedMeta.width ?? width;
  const pageHeight = resizedMeta.height ?? height;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const embedded = await pdfDoc[embedFn](imageBuffer);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
