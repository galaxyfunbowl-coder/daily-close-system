"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAmount } from "@/lib/format-amount";

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
  imagePath: string | null;
};

type Supplier = { id: string; name: string; defaultCategory: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthISO(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthToFromTo(month: string): { from: string; to: string } {
  if (!month || month.length !== 7) return { from: "2000-01-01", to: "2100-12-31" };
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

const MONTH_NAMES = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

const YEARS: number[] = (() => {
  const y = new Date().getFullYear();
  const out: number[] = [];
  for (let i = y - 5; i <= y + 1; i++) out.push(i);
  return out;
})();

function formatMonthLabel(month: string): string {
  if (!month || month.length !== 7) return "";
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const PAYMENT_METHODS = ["Μετρητά", "Κάρτα", "Τραπεζική μεταφορά"] as const;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<{ amount: number }[]>([]);
  const [filterMonth, setFilterMonth] = useState(currentMonthISO());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date: todayISO(),
    invoiceNumber: "",
    noInvoice: false,
    supplierId: "",
    category: "",
    amount: "",
    isCredit: false,
    paymentMethod: "Μετρητά",
    notes: "",
  });
  const [formImage, setFormImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", invoiceNumber: "", noInvoice: false, supplierId: "", category: "", amount: "", isCredit: false, paymentMethod: "", notes: "" });
  const [editImage, setEditImage] = useState<File | null>(null);

  const { from, to } = monthToFromTo(filterMonth);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`/api/expenses?${params}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data);
    }
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [expRes, supRes, fixedRes] = await Promise.all([
        fetch(`/api/expenses?${new URLSearchParams({ from, to })}`),
        fetch("/api/suppliers"),
        fetch(`/api/admin/fixed-expenses?month=${filterMonth}`),
      ]);
      if (cancelled) return;
      if (expRes.ok) setExpenses(await expRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (fixedRes.ok) {
        const fixedData = await fixedRes.json();
        setFixedExpenses(fixedData.items ?? []);
      } else {
        setFixedExpenses([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to, filterMonth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          invoiceNumber: form.noInvoice ? "" : (form.invoiceNumber || null),
          noInvoice: form.noInvoice,
          supplierId: form.supplierId || null,
          category: form.category,
          amount: (form.isCredit ? -1 : 1) * (parseFloat(form.amount) || 0),
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Σφάλμα");
        return;
      }
      const data = await res.json();
      const newId = data.id;
      let extractedInvoiceNumber = "";
      let extractedAmount = "";
      let extractedIsCredit = false;
      if (newId && formImage) {
        const fd = new FormData();
        fd.append("file", formImage);
        const upRes = await fetch(`/api/expenses/${newId}/invoice`, {
          method: "POST",
          body: fd,
        });
        const upData = await upRes.json().catch(() => ({}));
        extractedInvoiceNumber = upData.extractedInvoiceNumber ?? "";
        const amt = upData.extractedAmount;
        extractedAmount = amt != null ? String(Math.abs(amt)) : "";
        extractedIsCredit = amt != null && amt < 0;
      }
      setForm({
        date: todayISO(),
        invoiceNumber: extractedInvoiceNumber,
        noInvoice: form.noInvoice,
        supplierId: "",
        category: form.category,
        amount: extractedAmount,
        isCredit: extractedIsCredit,
        paymentMethod: form.paymentMethod,
        notes: "",
      });
      setFormImage(null);
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

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setEditImage(null);
    const pm = PAYMENT_METHODS.includes(exp.paymentMethod as (typeof PAYMENT_METHODS)[number])
      ? exp.paymentMethod
      : "Μετρητά";
    const isXt = exp.invoiceNumber?.startsWith("XT-") ?? false;
    setEditForm({
      date: exp.date,
      invoiceNumber: exp.invoiceNumber ?? "",
      noInvoice: isXt,
      supplierId: exp.supplierId ?? "",
      category: exp.category,
      amount: String(Math.abs(exp.amount)),
      isCredit: exp.amount < 0,
      paymentMethod: pm,
      notes: exp.notes,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editForm.date,
          invoiceNumber: editForm.noInvoice ? "" : (editForm.invoiceNumber || null),
          noInvoice: editForm.noInvoice,
          supplierId: editForm.supplierId || null,
          category: editForm.category,
          amount: (editForm.isCredit ? -1 : 1) * (parseFloat(editForm.amount) || 0),
          paymentMethod: editForm.paymentMethod,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Σφάλμα");
        return;
      }
      if (editImage) {
        const fd = new FormData();
        fd.append("file", editImage);
        const upRes = await fetch(`/api/expenses/${editingId}/invoice`, {
          method: "POST",
          body: fd,
        });
        const upData = await upRes.json().catch(() => ({}));
        setEditForm((p) => ({
          ...p,
          invoiceNumber: upData.extractedInvoiceNumber ?? p.invoiceNumber,
          amount:
            upData.extractedAmount != null
              ? String(upData.extractedAmount)
              : p.amount,
        }));
      }
      setEditingId(null);
      setEditImage(null);
      loadExpenses();
    } finally {
      setSaving(false);
    }
  }

  async function removeInvoiceImage(expenseId: string) {
    if (!confirm("Αφαίρεση τιμολογίου;")) return;
    const res = await fetch(`/api/expenses/${expenseId}/invoice`, { method: "DELETE" });
    if (res.ok) loadExpenses();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Διαγραφή εξόδου; Δεν γίνεται αναίρεση.")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) loadExpenses();
    else alert("Σφάλμα διαγραφής");
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
            <div className="flex gap-2 items-center mt-1">
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                className="input-field flex-1"
                placeholder={form.noInvoice ? "XT-X (αυτόματο)" : ""}
                disabled={form.noInvoice}
              />
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input type="checkbox" checked={form.noInvoice} onChange={(e) => setForm((p) => ({ ...p, noInvoice: e.target.checked, invoiceNumber: e.target.checked && !p.invoiceNumber.startsWith("XT-") ? "" : p.invoiceNumber }))} className="rounded" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Χωρίς τιμολόγιο</span>
              </label>
            </div>
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
            <input type="number" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Ποσό" className="input-field mt-1" required />
            <label className="mt-2 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isCredit} onChange={(e) => setForm((p) => ({ ...p, isCredit: e.target.checked }))} className="rounded" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Πιστωτικό</span>
            </label>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Τρόπος πληρωμής</label>
            <select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="input-field mt-1">
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Σημειώσεις</label>
            <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="input-field mt-1" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Φωτογραφία ή PDF τιμολογίου (προαιρετικό)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={(e) => setFormImage(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-neutral-600 dark:text-neutral-400 file:mr-2 file:rounded file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-900 dark:file:bg-neutral-600 dark:file:text-neutral-100"
            />
            {formImage && <p className="mt-1 text-xs text-neutral-500">{formImage.name}</p>}
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "..." : "Προσθήκη"}
          </button>
        </form>
      </section>

      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Μήνας</h2>
        <div className="flex gap-2">
          <select
            value={filterMonth.slice(5, 7)}
            onChange={(e) => setFilterMonth((prev) => `${prev.slice(0, 4)}-${e.target.value}`)}
            className="input-field flex-1"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
            ))}
          </select>
          <select
            value={filterMonth.slice(0, 4)}
            onChange={(e) => setFilterMonth((prev) => `${e.target.value}-${prev.slice(5, 7)}`)}
            className="input-field flex-1"
          >
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card-section overflow-hidden p-0">
        <h2 className="p-3 font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700">
          {formatMonthLabel(filterMonth)}
          {!loading && (
            <>
              <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                — σύνολο εξόδων{" "}
                {formatAmount(expenses.reduce((s, e) => s + e.amount, 0) + fixedExpenses.reduce((s, e) => s + e.amount, 0))} €
              </span>
              <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                — {expenses.length} {expenses.length === 1 ? "τιμολόγιο" : "τιμολόγια"}
              </span>
            </>
          )}
        </h2>
        {loading ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
        ) : expenses.length === 0 ? (
          <p className="p-4 text-neutral-500 dark:text-neutral-400">Δεν υπάρχουν έξοδα</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {expenses.map((e) => (
              <li key={e.id} className="p-3">
                {editingId === e.id ? (
                  <div className="space-y-2">
                    <input type="date" value={editForm.date} onChange={(ev) => setEditForm((p) => ({ ...p, date: ev.target.value }))} className="input-field text-sm" />
                    <div className="flex gap-2 items-center">
                      <input type="text" value={editForm.invoiceNumber} onChange={(ev) => setEditForm((p) => ({ ...p, invoiceNumber: ev.target.value }))} placeholder="Αρ. τιμολογίου" className="input-field text-sm flex-1" disabled={editForm.noInvoice} />
                      <label className="flex items-center gap-1 cursor-pointer shrink-0">
                        <input type="checkbox" checked={editForm.noInvoice} onChange={(ev) => setEditForm((p) => ({ ...p, noInvoice: ev.target.checked, invoiceNumber: ev.target.checked && !p.invoiceNumber.startsWith("XT-") ? "" : p.invoiceNumber }))} className="rounded" />
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">Χωρίς τιμολόγιο</span>
                      </label>
                    </div>
                    <select value={editForm.supplierId} onChange={(ev) => { const s = suppliers.find((x) => x.id === ev.target.value); setEditForm((p) => ({ ...p, supplierId: ev.target.value, category: s ? s.defaultCategory : p.category })); }} className="input-field text-sm">
                      <option value="">—</option>
                      {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                    <input type="text" value={editForm.category} onChange={(ev) => setEditForm((p) => ({ ...p, category: ev.target.value }))} placeholder="Κατηγορία" className="input-field text-sm" />
                    <input type="number" step="0.01" min="0" inputMode="decimal" value={editForm.amount} onChange={(ev) => setEditForm((p) => ({ ...p, amount: ev.target.value }))} placeholder="Ποσό" className="input-field text-sm" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.isCredit} onChange={(ev) => setEditForm((p) => ({ ...p, isCredit: ev.target.checked }))} className="rounded" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">Πιστωτικό</span>
                    </label>
                    <select value={editForm.paymentMethod} onChange={(ev) => setEditForm((p) => ({ ...p, paymentMethod: ev.target.value }))} className="input-field text-sm">
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>{pm}</option>
                      ))}
                    </select>
                    <input type="text" value={editForm.notes} onChange={(ev) => setEditForm((p) => ({ ...p, notes: ev.target.value }))} placeholder="Σημειώσεις" className="input-field text-sm" />
                    <div>
                      <label className="block text-xs text-neutral-500 dark:text-neutral-400">Φωτογραφία/PDF τιμολογίου</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        capture="environment"
                        onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                        className="mt-1 block w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-neutral-200 file:px-2 file:py-1 file:text-xs dark:file:bg-neutral-600"
                      />
                      {editImage && <span className="text-xs text-neutral-500">{editImage.name}</span>}
                      {e.imagePath && !editImage && (
                        <button type="button" onClick={() => removeInvoiceImage(e.id)} className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline">Αφαίρεση τιμολογίου</button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary text-sm px-3 py-1.5">Αποθήκευση</button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100">Ακύρωση</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{e.date}</p>
                      <p className={`text-sm ${e.amount < 0 ? "text-green-600 dark:text-green-400" : "text-neutral-600 dark:text-neutral-400"}`}>{e.supplierName ?? e.category} — {formatAmount(e.amount)} €{e.amount < 0 ? " (πιστωτικό)" : ""}</p>
                      {e.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400">{e.notes}</p>}
                      {e.imagePath && (
                        <a
                          href={`/api/expenses/${e.id}/invoice`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          📄 Τιμολόγιο
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => startEdit(e)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Επεξεργασία</button>
                      <button type="button" onClick={() => deleteExpense(e.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
