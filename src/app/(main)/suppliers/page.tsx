"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format-amount";

type SupplierRow = {
  id: string;
  name: string;
  vatNumber: string | null;
  defaultCategory: string;
  _count: { expenses: number };
  _sum: { amount: number | null };
  lastDate: string | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/suppliers/list");
    if (res.ok) setSuppliers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doMerge() {
    if (!mergeSource || !mergeTarget) return;
    if (!confirm("Μεταφορά εξόδων και διαγραφή διπλότυπου;")) return;
    const res = await fetch("/api/suppliers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: mergeTarget, sourceId: mergeSource }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(`Συγχωνεύτηκαν ${data.movedExpenses} έξοδα → ${data.targetSupplier}`);
      setMergeSource(null);
      setMergeTarget("");
      load();
    } else {
      alert(data.error ?? "Σφάλμα");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Προμηθευτές</h1>

      {mergeSource && (
        <section className="card-section space-y-3">
          <h2 className="font-medium text-neutral-700 dark:text-neutral-300">
            Συγχώνευση: {suppliers.find((s) => s.id === mergeSource)?.name}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Επιλέξτε τον προμηθευτή στον οποίο θα μεταφερθούν τα έξοδα:
          </p>
          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="input-field">
            <option value="">—</option>
            {suppliers.filter((s) => s.id !== mergeSource).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.vatNumber ? ` (${s.vatNumber})` : ""}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={doMerge} disabled={!mergeTarget} className="btn-primary text-sm px-4">Συγχώνευση</button>
            <button type="button" onClick={() => { setMergeSource(null); setMergeTarget(""); }} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Ακύρωση</button>
          </div>
        </section>
      )}

      <section className="card-section overflow-hidden p-0">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="font-medium text-neutral-700 dark:text-neutral-300">
            {suppliers.length} Προμηθευτές
          </h2>
        </div>
        {loading ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Όνομα</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">ΑΦΜ</th>
                  <th className="text-right px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Σύνολο €</th>
                  <th className="text-right px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Τιμολόγια</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Τελ. τιμ.</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Κατηγορία</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="px-3 py-2">
                      <Link href={`/suppliers/${s.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400 font-mono text-xs">{s.vatNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatAmount(s._sum.amount ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{s._count.expenses}</td>
                    <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{s.lastDate ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{s.defaultCategory}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => { setMergeSource(s.id); setMergeTarget(""); }}
                        className="text-xs text-neutral-500 dark:text-neutral-400 hover:underline"
                      >
                        Merge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
