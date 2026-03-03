/**
 * Compress PDF buffer using Ghostscript.
 * Falls back to original if Ghostscript is not installed.
 * Install: Windows (choco install ghostscript), macOS (brew install ghostscript)
 */

export async function compressPdfBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    const { compress } = await import("compress-pdf");
    const compressed = await compress(buffer, {
      resolution: "ebook",
      imageQuality: 150,
    });
    return compressed.length < buffer.length ? compressed : buffer;
  } catch {
    return buffer;
  }
}
