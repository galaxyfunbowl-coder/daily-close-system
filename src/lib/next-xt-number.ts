import { prisma } from "@/lib/db";

const XT_PREFIX = "XT-";

export async function getNextXtNumber(): Promise<string> {
  const expenses = await prisma.expense.findMany({
    where: { invoiceNumber: { startsWith: XT_PREFIX } },
    select: { invoiceNumber: true },
  });
  const numbers = expenses
    .map((e) => {
      const num = e.invoiceNumber?.slice(XT_PREFIX.length);
      return num ? parseInt(num, 10) : 0;
    })
    .filter((n) => !Number.isNaN(n));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `${XT_PREFIX}${next}`;
}

export function isXtInvoiceNumber(invoiceNumber: string | null): boolean {
  return (invoiceNumber?.startsWith(XT_PREFIX) ?? false);
}
