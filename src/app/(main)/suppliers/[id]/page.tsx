"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatAmount } from "@/lib/format-amount";

type SupplierDetail = {
  id: string;
  name: string;
  vatNumber: string | null;
  defaultCategory: string;
};

type Stats = {
  totalExpenses: number;
  invoiceCount: number;
  averageInvoice: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
};

type ExpenseRow = {
  id: string;
  date: string;
  invoiceNumber: string | null;
  amount: number;
  category: string;
  paymentMethod: string;
  notes: string | null;
  imagePath: string | null;
  source: string | null;
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/suppliers/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSupplier(data.supplier);
      setStats(data.stats);
      setExpenses(data.expenses);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="p-8 text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>;
  }

  if (!supplier) {
    return <p className="p-8 text-red-600 dark:text-red-400">Δεν βρέθηκε</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/suppliers" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Προμηθευτές</Link>
      </div>

      <section className="card-section">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{supplier.name}</h1>
        <div className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <p>ΑΦΜ: <span className="font-mono">{supplier.vatNumber ?? "—"}</span></p>
          <p>Κατηγορία: {supplier.defaultCategory}</p>
        </div>
      </section>

      {stats && (
        <section className="card-section">
          <h2 className="font-medium text-neutral-700 dark:text-neutral-300 mb-3">Στατιστικά</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Σύνολο εξόδων</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatAmount(stats.totalExpenses)} €</p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Τιμολόγια</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{stats.invoiceCount}</p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Μ.Ο. τιμολογίου</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatAmount(stats.averageInvoice)} €</p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Πρώτο τιμολόγιο</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{stats.firstInvoiceDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Τελευταίο τιμολόγιο</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{stats.lastInvoiceDate ?? "—"}</p>
            </div>
          </div>
        </section>
      )}

      <section className="card-section overflow-hidden p-0">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="font-medium text-neutral-700 dark:text-neutral-300">Τιμολόγια ({expenses.length})</h2>
        </div>
        {expenses.length === 0 ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Δεν υπάρχουν τιμολόγια</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {expenses.map((e) => (
              <li key={e.id} className="px-3 py-2 flex justify-between items-center text-sm">
                <div>
                  <span className="text-neutral-900 dark:text-neutral-100">{e.date}</span>
                  {e.invoiceNumber && <span className="ml-2 text-neutral-500 dark:text-neutral-400">#{e.invoiceNumber}</span>}
                  {e.source === "MYDATA" && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">myDATA</span>
                  )}
                  {e.notes && <span className="ml-2 text-xs text-neutral-400">{e.notes}</span>}
                </div>
                <span className={`font-medium ${e.amount < 0 ? "text-green-600 dark:text-green-400" : "text-neutral-900 dark:text-neutral-100"}`}>
                  {formatAmount(e.amount)} €
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
