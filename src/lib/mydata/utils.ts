export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeGreekVat(vat: string): string {
  const digits = vat.replace(/\D/g, "");
  if (digits.length === 8) return `0${digits}`;
  return digits.length === 9 ? digits : vat;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildInvoiceNumber(
  series: string | undefined,
  aa: string | undefined
): string | null {
  if (series && aa) return `${series}-${aa}`;
  if (aa) return aa;
  if (series) return series;
  return null;
}
