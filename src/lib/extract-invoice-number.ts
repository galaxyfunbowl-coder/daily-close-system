/**
 * Extract invoice number and total amount from PDF or image text using common patterns.
 */

export type ExtractedInvoiceData = {
  invoiceNumber: string | null;
  amount: number | null;
};

const INVOICE_PATTERNS: RegExp[] = [
  /αρ\.?\s*τιμολογίου\s*:?\s*([\w\d\-\/\.]+)/i,
  /αριθμός\s*τιμολογίου\s*:?\s*([\w\d\-\/\.]+)/i,
  /τιμολόγιο\s*#?\s*:?\s*([\w\d\-\.]+)/i,
  /τιμ\.?\s*:?\s*([\w\d\-\.]+)/i,
  /invoice\s*#?\s*:?\s*([\w\d\-\.]+)/i,
  /invoice\s*no\.?\s*:?\s*([\w\d\-\.]+)/i,
  /no\.?\s*:?\s*([\w\d\-\.]+)/i,
  /αριθμός\s*:?\s*([\w\d\-\.\/]+)/i,
];

const AMOUNT_PATTERNS: RegExp[] = [
  /τελικό\s*ποσό[ν]?\s*:?\s*([\d\s.,]+)\s*€?/i,
  /σύνολο\s*:?\s*([\d\s.,]+)\s*€?/i,
  /ισοζύγιο\s*:?\s*([\d\s.,]+)\s*€?/i,
  /total\s*:?\s*([\d\s.,]+)\s*€?/i,
  /amount\s*:?\s*([\d\s.,]+)\s*€?/i,
  /αξία\s*:?\s*([\d\s.,]+)\s*€?/i,
  /([\d\s.,]+)\s*€\s*$/i,
  /€\s*([\d\s.,]+)/i,
];

const MAX_INVOICE_LENGTH = 50;
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 999_999.99;

function parseAmountString(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").trim();
  if (!cleaned || !/[\d]/.test(cleaned)) return null;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
    const afterSep = cleaned.slice(lastSep + 1);
    if (afterSep.length === 2 && /^\d\d$/.test(afterSep)) {
      normalized = cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + afterSep;
    } else {
      normalized = cleaned.replace(",", ".");
    }
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }
  const num = parseFloat(normalized);
  if (Number.isNaN(num) || num < MIN_AMOUNT || num > MAX_AMOUNT) return null;
  return Math.round(num * 100) / 100;
}

function extractInvoiceNumberFromText(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ");
  for (const pattern of INVOICE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length > 0 && value.length <= MAX_INVOICE_LENGTH) {
        return value;
      }
    }
  }
  return null;
}

function extractAmountFromText(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ");
  for (const pattern of AMOUNT_PATTERNS) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const parsed = parseAmountString(match[1]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractFromText(text: string): ExtractedInvoiceData {
  return {
    invoiceNumber: extractInvoiceNumberFromText(text),
    amount: extractAmountFromText(text),
  };
}

export async function extractInvoiceDataFromPdf(buffer: Buffer): Promise<ExtractedInvoiceData> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return extractFromText(result.text ?? "");
  } catch {
    return { invoiceNumber: null, amount: null };
  }
}

export async function extractInvoiceDataFromImage(buffer: Buffer): Promise<ExtractedInvoiceData> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ell+eng", 1, {
      logger: () => {},
    });
    const {
      data: { text },
    } = await worker.recognize(buffer);
    await worker.terminate();
    return extractFromText(text ?? "");
  } catch {
    return { invoiceNumber: null, amount: null };
  }
}
