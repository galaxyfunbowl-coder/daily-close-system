/**
 * Format amount in European style: 1.500,50 (thousands separator ., decimal ,)
 */

export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const formatted = `${withThousands},${decPart}`;
  return value < 0 ? `−${formatted}` : formatted;
}
