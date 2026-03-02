"use client";

import { useCallback, useEffect, useState } from "react";

type Expense = {
  id: string;
  date: string;
  invoiceNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  category: string;
  amount: number;
  paymentMethod: string;
  notes: string;
};

type Supplier = { id: string; name: string; defaultCategory: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date: todayISO(),
    invoiceNumber: "",
    supplierId: "",
    category: "",
    amount: "",
    paymentMethod: "Μετρητά",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const res = await fetch(`/api/expenses?${params}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data);
    }
  }, [filterFrom, filterTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [expRes, supRes] = await Promise.all([
        fetch(`/api/expenses?${new URLSearchParams({ from: filterFrom || "2000-01-01", to: filterTo || "2100-12-31" })}`),
        fetch("/api/suppliers"),
      ]);
      if (cancelled) return;
      if (expRes.ok) setExpenses(await expRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [filterFrom, filterTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          invoiceNumber: form.invoiceNumber || null,
          supplierId: form.supplierId || null,
          category: form.category,
          amount: parseFloat(form.amount) || 0,
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Σφάλμα");
        return;
      }
      setForm({
        date: todayISO(),
        invoiceNumber: "",
        supplierId: "",
        category: form.category,
        amount: "",
        paymentMethod: form.paymentMethod,
        notes: "",
      });
      loadExpenses();
    } finally {
      setSaving(false);
    }
  }

  function onSupplierChange(supplierId: string) {
    const s = suppliers.find((x) => x.id === supplierId);
    setForm((prev) => ({
      ...prev,
      supplierId,
      category: s ? s.defaultCategory : prev.category,
    }));
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Έξοδα</h1>

      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Νέο έξοδο</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Ημερομηνία</label>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="input-field mt-1" required />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Αριθμός τιμολογίου</label>
            <input type="text" value={form.invoiceNumber} onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))} className="input-field mt-1" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Προμηθευτής</label>
            <select value={form.supplierId} onChange={(e) => onSupplierChange(e.target.value)} className="input-field mt-1">
              <option value="">—</option>
              {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Κατηγορία</label>
            <input type="text" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Αυτόματο από προμηθευτή, επεξεργάσιμο" className="input-field mt-1" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Ποσό</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="input-field mt-1" required />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Τρόπος πληρωμής</label>
            <input type="text" value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="input-field mt-1" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Σημειώσεις</label>
            <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="input-field mt-1" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "..." : "Προσθήκη"}
          </button>
        </form>
      </section>

      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Φίλτρο</h2>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="input-field" />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="input-field" />
        </div>
      </section>

      <section className="card-section overflow-hidden p-0">
        <h2 className="p-3 font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700">Κατάλογος</h2>
        {loading ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
        ) : expenses.length === 0 ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Δεν υπάρχουν έξοδα</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {expenses.map((e) => (
              <li key={e.id} className="p-3 flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{e.date}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{e.supplierName ?? e.category} — {e.amount.toFixed(2)} €</p>
                  {e.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400">{e.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
