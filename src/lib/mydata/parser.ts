/**
 * Parse myDATA (AADE) XML response into normalized expense documents.
 */

import { XMLParser } from "fast-xml-parser";

export type NormalizedMyDataExpense = {
  mark: string;
  uid?: string;
  issuerVat?: string;
  issuerName?: string;
  receiverVat?: string;
  issueDate?: string;
  invoiceType?: string;
  series?: string;
  aa?: string;
  netAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  currency?: string;
  isCancelled?: boolean;
  cancellationMark?: string;
  rawSnippet?: Record<string, unknown>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

function toNum(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const n = parseFloat(String(val));
  return Number.isNaN(n) ? undefined : n;
}

function toStr(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  const s = String(val).trim();
  return s === "" ? undefined : s;
}

function toDateStr(val: unknown): string | undefined {
  const s = toStr(val);
  if (!s) return undefined;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}-${ddmmyyyy[1].padStart(2, "0")}`;
  return undefined;
}

function collectExpensesFromNode(
  node: unknown,
  acc: NormalizedMyDataExpense[]
): void {
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;

  const mark = toStr(obj.mark ?? obj.MARK ?? obj.Mark ?? obj.minMark ?? obj.maxMark);
  if (mark) {
    const netAmount = toNum(obj.netAmount ?? obj.netamount ?? obj.net_value ?? obj.netValue ?? obj.netvalue);
    const vatAmount = toNum(obj.vatAmount ?? obj.vatamount ?? obj.vat_value);
    const totalAmount = toNum(
      obj.totalAmount ?? obj.totalamount ?? obj.gross_value ?? obj.grossValue ?? obj.grossvalue
    );
    const amount =
      totalAmount ?? (netAmount != null && vatAmount != null ? netAmount + vatAmount : undefined);

    acc.push({
      mark,
      uid: toStr(obj.uid ?? obj.UID),
      issuerVat: toStr(obj.issuerVat ?? obj.issuervat ?? obj.vat_number ?? obj.afm ?? obj.counterVatNumber ?? obj.countervatnumber),
      issuerName: toStr(
        obj.issuerName ?? obj.issuername ?? obj.company_name ??
        obj.counterPartyName ?? obj.counterpartyName ?? obj.counterPartName ??
        obj.counterCompanyName ?? obj.countercompanyname ?? obj.companyName ??
        obj.partyName ?? obj.counterName ?? obj.issuer
      ),
      receiverVat: toStr(obj.receiverVat ?? obj.receivervat),
      issueDate: toDateStr(obj.issueDate ?? obj.issuedate ?? obj.date),
      invoiceType: toStr(obj.invoiceType ?? obj.invoicetype ?? obj.invoice_type),
      series: toStr(obj.series ?? obj.Series),
      aa: toStr(obj.aa ?? obj.AA),
      netAmount,
      vatAmount,
      totalAmount: amount ?? totalAmount,
      currency: toStr(obj.currency ?? obj.Currency) ?? "EUR",
      isCancelled:
        toStr(obj.cancellationMark ?? obj.cancellationmark) != null ||
        obj.isCancelled === true ||
        obj.iscancelled === true,
      cancellationMark: toStr(obj.cancellationMark ?? obj.cancellationmark),
      rawSnippet: {
        mark,
        issuerVat: obj.issuerVat ?? obj.issuervat,
        issueDate: obj.issueDate ?? obj.issuedate,
        totalAmount: amount ?? totalAmount,
      },
    });
    return;
  }

  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) collectExpensesFromNode(item, acc);
    } else {
      collectExpensesFromNode(v, acc);
    }
  }
}

function findExpenseArrays(root: Record<string, unknown>): unknown[] {
  const candidates: unknown[] = [];

  const keys = [
    "expenses",
    "Expenses",
    "expensesDoc",
    "expensesdocs",
    "response",
    "Response",
    "invoices",
    "Invoices",
    "docs",
    "Docs",
    "expensesClassification",
    "expensesclassification",
    "bookInfo",
    "bookInfos",
    "BookInfo",
    "BookInfos",
  ];

  for (const k of keys) {
    const v = root[k];
    if (Array.isArray(v)) candidates.push(...v);
    else if (v && typeof v === "object") candidates.push(v);
  }

  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    const x = o as Record<string, unknown>;
    if (x.mark || x.MARK || x.Mark || x.minMark || x.maxMark) {
      candidates.push(o);
      return;
    }
    for (const val of Object.values(x)) {
      if (Array.isArray(val)) {
        for (const item of val) walk(item);
      } else {
        walk(val);
      }
    }
  };

  walk(root);
  return candidates;
}

export function parseMyExpensesResponse(xmlText: string): NormalizedMyDataExpense[] {
  const trimmed = xmlText.trim();
  let root: Record<string, unknown>;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      root = typeof json === "object" && json !== null && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : Array.isArray(json)
          ? { items: json }
          : {};
    } catch {
      return [];
    }
  } else {
    const parsed = parser.parse(xmlText);
    if (!parsed || typeof parsed !== "object") return [];
    root = parsed as Record<string, unknown>;
  }
  const acc: NormalizedMyDataExpense[] = [];

  const arrays = findExpenseArrays(root);
  for (const item of arrays) {
    collectExpensesFromNode(item, acc);
  }

  if (acc.length === 0) {
    collectExpensesFromNode(root, acc);
  }

  const seen = new Set<string>();
  return acc.filter((e) => {
    if (!e.mark || e.isCancelled) return false;
    if (seen.has(e.mark)) return false;
    seen.add(e.mark);
    return true;
  });
}
