"use client";

import { useCallback, useEffect, useState } from "react";

type Staff = { id: string; name: string; role: string; active: boolean };
type Supplier = { id: string; name: string; defaultCategory: string };
type Holiday = { id: string; date: string; name: string };
type Closure = { id: string; date: string; reason: string };
type FixedMonthlyExpense = { id: string; name: string; amount: number };

type ElectronicOperatorRow = { id: string; name: string; active: boolean };
type Tab = "staff" | "suppliers" | "electronic" | "payroll" | "fixed" | "holidays" | "closures";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("staff");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [electronicOperators, setElectronicOperators] = useState<ElectronicOperatorRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, sup, ops, h, c] = await Promise.all([
      fetch("/api/admin/staff").then((r) => r.json()),
      fetch("/api/admin/suppliers").then((r) => r.json()),
      fetch("/api/admin/electronic-operators").then((r) => r.json()),
      fetch("/api/admin/holidays").then((r) => r.json()),
      fetch("/api/admin/closures").then((r) => r.json()),
    ]);
    setStaff(Array.isArray(s) ? s : []);
    setSuppliers(Array.isArray(sup) ? sup : []);
    setElectronicOperators(Array.isArray(ops) ? ops : []);
    setHolidays(Array.isArray(h) ? h : []);
    setClosures(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Διαχείριση</h1>

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700 flex-wrap">
        {(["staff", "suppliers", "electronic", "payroll", "fixed", "holidays", "closures"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? "border-neutral-800 dark:border-neutral-200 text-neutral-900 dark:text-neutral-100"
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {t === "staff" && "Προσωπικό"}
            {t === "suppliers" && "Προμηθευτές"}
            {t === "electronic" && "Ηλεκτρονικά"}
            {t === "payroll" && "Μισθοδοσία"}
            {t === "fixed" && "Πάγια έξοδα"}
            {t === "holidays" && "Αργίες"}
            {t === "closures" && "Κλεισίματα"}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <StaffSection staff={staff} loading={loading} onSaved={load} />
      )}
      {tab === "suppliers" && (
        <SuppliersSection suppliers={suppliers} loading={loading} onSaved={load} />
      )}
      {tab === "electronic" && (
        <ElectronicOperatorsSection operators={electronicOperators} loading={loading} onSaved={load} />
      )}
      {tab === "payroll" && (
        <PayrollSection staff={staff} />
      )}
      {tab === "fixed" && (
        <FixedExpensesSection />
      )}
      {tab === "holidays" && (
        <HolidaysSection holidays={holidays} loading={loading} onSaved={load} />
      )}
      {tab === "closures" && (
        <ClosuresSection closures={closures} loading={loading} onSaved={load} />
      )}
    </div>
  );
}

const STAFF_ROLES = ["SERVER", "ADMIN"] as const;

function StaffSection({
  staff,
  loading,
  onSaved,
}: {
  staff: Staff[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("SERVER");
  const [editActive, setEditActive] = useState(true);

  function startEdit(s: Staff) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRole(s.role);
    setEditActive(s.active);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole,
          active: editActive,
        }),
      });
      if (res.ok) {
        onSaved();
        cancelEdit();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setName("");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteStaff(id: string) {
    if (!confirm("Διαγραφή μέλους προσωπικού;")) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    if (res.ok) onSaved();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Σφάλμα");
    }
  }

  return (
    <section className="card-section space-y-4">
      <form onSubmit={addStaff} className="flex gap-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα προσωπικού" className="input-field flex-1" />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {staff.map((s) => (
            <li key={s.id} className="py-2">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Όνομα" className="input-field w-full" />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="input-field text-sm">
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>{r === "SERVER" ? "Server" : "Admin"}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                      <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                      Ενεργό
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary text-sm px-3">Αποθήκευση</button>
                    <button type="button" onClick={cancelEdit} disabled={saving} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Ακύρωση</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <span className={s.active ? "text-neutral-900 dark:text-neutral-100 font-medium" : "text-neutral-500 dark:text-neutral-400 line-through"}>{s.name}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => startEdit(s)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Επεξεργασία</button>
                    <button type="button" onClick={() => deleteStaff(s.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SuppliersSection({
  suppliers,
  loading,
  onSaved,
}: {
  suppliers: Supplier[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefaultCategory, setEditDefaultCategory] = useState("");

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDefaultCategory(s.defaultCategory);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), defaultCategory: editDefaultCategory.trim() }),
      });
      if (res.ok) {
        onSaved();
        cancelEdit();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), defaultCategory: defaultCategory.trim() }),
      });
      if (res.ok) {
        setName("");
        setDefaultCategory("");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Διαγραφή προμηθευτή; Τα εξοδα που τον χρησιμοποιούν θα μείνουν χωρίς προμηθευτή.")) return;
    const res = await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
    if (res.ok) onSaved();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Σφάλμα");
    }
  }

  return (
    <section className="card-section space-y-4">
      <form onSubmit={addSupplier} className="space-y-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα προμηθευτή" className="input-field" />
        <input type="text" value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} placeholder="Προεπιλεγμένη κατηγορία" className="input-field" />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {suppliers.map((s) => (
            <li key={s.id} className="py-2">
              {editingId === s.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Όνομα" className="input-field flex-1 min-w-0" />
                  <input type="text" value={editDefaultCategory} onChange={(e) => setEditDefaultCategory(e.target.value)} placeholder="Προεπιλεγμένη κατηγορία" className="input-field flex-1 min-w-0" />
                  <button type="button" onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary text-sm px-3">Αποθήκευση</button>
                  <button type="button" onClick={cancelEdit} disabled={saving} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Ακύρωση</button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</span>
                    <span className="text-neutral-500 dark:text-neutral-400 text-sm"> — {s.defaultCategory}</span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => startEdit(s)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Επεξεργασία</button>
                    <button type="button" onClick={() => deleteSupplier(s.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ElectronicOperatorsSection({
  operators,
  loading,
  onSaved,
}: {
  operators: ElectronicOperatorRow[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(op: ElectronicOperatorRow) {
    setEditingId(op.id);
    setEditName(op.name);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/electronic-operators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName.trim() }),
      });
      if (res.ok) {
        onSaved();
        cancelEdit();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(op: ElectronicOperatorRow) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/electronic-operators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: op.id, active: !op.active }),
      });
      if (res.ok) onSaved();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/electronic-operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteOperator(op: ElectronicOperatorRow) {
    if (!confirm(`Διαγραφή παροχού «${op.name}»; Οι γραμμές ηλεκτρονικών που τον χρησιμοποιούν θα μείνουν χωρίς παροχό.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/electronic-operators?id=${encodeURIComponent(op.id)}`, { method: "DELETE" });
      if (res.ok) onSaved();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-section space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Πρόσθεσε ή αφαίρεσε παροχούς ηλεκτρονικών. Ενεργό = εμφανίζεται στο Daily στο dropdown.
      </p>
      <form onSubmit={addOperator} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Όνομα παροχού (π.χ. Adam Games)"
          className="input-field flex-1 min-w-0"
        />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {operators.map((op) => (
            <li key={op.id} className="py-2">
              {editingId === op.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Όνομα παροχού"
                    className="input-field flex-1 min-w-0"
                  />
                  <button type="button" onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary text-sm px-3">Αποθήκευση</button>
                  <button type="button" onClick={cancelEdit} disabled={saving} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Ακύρωση</button>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className={op.active ? "text-neutral-900 dark:text-neutral-100 font-medium" : "text-neutral-500 dark:text-neutral-400"}>
                    {op.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={op.active}
                        onChange={() => toggleActive(op)}
                        disabled={saving}
                      />
                      Ενεργό
                    </label>
                    <button type="button" onClick={() => startEdit(op)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Επεξεργασία</button>
                    <button type="button" onClick={() => deleteOperator(op)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MONTH_NAMES = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

function PayrollSection({ staff }: { staff: Staff[] }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const [month, setMonth] = useState(currentMonthStr);
  const [salaries, setSalaries] = useState<{ staffId: string; staffName: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [y, m] = month.split("-").map(Number);

  const loadSalaries = useCallback(async (mStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/staff-salaries?month=${mStr}`);
      if (res.ok) {
        const d = await res.json();
        setSalaries(Array.isArray(d.salaries) ? d.salaries : []);
      } else {
        setSalaries([]);
      }
    } catch {
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSalaries(month);
  }, [month, loadSalaries]);

  const setYearMonth = (year: number, monthNum: number) => {
    setMonth(`${year}-${String(monthNum).padStart(2, "0")}`);
  };

  function setAmount(staffId: string, value: number) {
    setSalaries((prev) => {
      const next = prev.map((r) => (r.staffId === staffId ? { ...r, amount: value } : r));
      const found = next.some((r) => r.staffId === staffId);
      if (!found) {
        const staffMember = staff.find((s) => s.id === staffId);
        next.push({ staffId, staffName: staffMember?.name ?? "", amount: value });
      }
      return next;
    });
  }

  const rows = staff.length > 0
    ? staff.map((s) => ({
        staffId: s.id,
        staffName: s.name,
        amount: salaries.find((r) => r.staffId === s.id)?.amount ?? 0,
      }))
    : salaries;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/staff-salaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          salaries: rows.map((r) => ({ staffId: r.staffId, amount: r.amount })),
        }),
      });
      if (res.ok) {
        loadSalaries(month);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <section className="card-section space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={m}
          onChange={(e) => setYearMonth(y, Number(e.target.value))}
          className="input-field text-sm w-auto min-w-[140px]"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={y}
          onChange={(e) => setYearMonth(Number(e.target.value), m)}
          className="input-field text-sm w-auto min-w-[100px]"
        >
          {years.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700 space-y-2">
            {rows.map((r) => (
              <li key={r.staffId} className="py-2 flex justify-between items-center gap-2">
                <span className="text-neutral-900 dark:text-neutral-100 font-medium truncate">{r.staffName}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={r.amount || ""}
                  onChange={(e) => setAmount(r.staffId, e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                  placeholder="€"
                  className="input-field w-28 text-right"
                />
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Σύνολο μισθοδοσίας: <strong>{total.toFixed(2)} €</strong>
          </p>
          <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm px-4">
            {saving ? "Αποθήκευση..." : "Αποθήκευση"}
          </button>
        </>
      )}
    </section>
  );
}

function FixedExpensesSection() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const [month, setMonth] = useState(currentMonthStr);
  const [items, setItems] = useState<FixedMonthlyExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const [y, m] = month.split("-").map(Number);

  const setYearMonth = (year: number, monthNum: number) => {
    setMonth(`${year}-${String(monthNum).padStart(2, "0")}`);
  };

  const loadItems = useCallback(async (mStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/fixed-expenses?month=${mStr}`);
      if (res.ok) {
        const d = await res.json();
        setItems(Array.isArray(d.items) ? d.items : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems(month);
  }, [month, loadItems]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const amount = newAmount.trim() === "" ? 0 : parseFloat(newAmount) || 0;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, name: newName.trim(), amount }),
      });
      if (res.ok) {
        setNewName("");
        setNewAmount("");
        loadItems(month);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: FixedMonthlyExpense) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    const amount = editAmount.trim() === "" ? 0 : parseFloat(editAmount) || 0;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/fixed-expenses/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), amount }),
      });
      if (res.ok) {
        cancelEdit();
        loadItems(month);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Διαγραφή παγίου εξόδου;")) return;
    const res = await fetch(`/api/admin/fixed-expenses/${id}`, { method: "DELETE" });
    if (res.ok) loadItems(month);
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Σφάλμα");
    }
  }

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <section className="card-section space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={m}
          onChange={(e) => setYearMonth(y, Number(e.target.value))}
          className="input-field text-sm w-auto min-w-[140px]"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={y}
          onChange={(e) => setYearMonth(Number(e.target.value), m)}
          className="input-field text-sm w-auto min-w-[100px]"
        >
          {years.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>

      <form onSubmit={addItem} className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Όνομα παγίου"
          className="input-field flex-1 min-w-[140px]"
        />
        <input
          type="number"
          min={0}
          step={0.01}
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          placeholder="Ποσό (€)"
          className="input-field w-28"
        />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {items.map((item) => (
              <li key={item.id} className="py-2">
                {editingId === item.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field flex-1 min-w-[140px]"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="input-field w-28"
                    />
                    <button type="button" onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary text-sm px-3">Αποθήκευση</button>
                    <button type="button" onClick={cancelEdit} disabled={saving} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Ακύρωση</button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {item.name} — {item.amount.toFixed(2)} €
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => startEdit(item)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">Επεξεργασία</button>
                      <button type="button" onClick={() => deleteItem(item.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Σύνολο παγίων: <strong>{total.toFixed(2)} €</strong>
          </p>
        </>
      )}
    </section>
  );
}

function HolidaysSection({
  holidays,
  loading,
  onSaved,
}: {
  holidays: Holiday[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      if (res.ok) {
        setDate("");
        setName("");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteHoliday(id: string) {
    if (!confirm("Διαγραφή;")) return;
    const res = await fetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
    if (res.ok) onSaved();
  }

  return (
    <section className="card-section space-y-4">
      <form onSubmit={addHoliday} className="space-y-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα αργίας" className="input-field" />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {holidays.map((h) => (
            <li key={h.id} className="py-2 flex justify-between items-center text-neutral-900 dark:text-neutral-100">
              <span>{h.date} — {h.name}</span>
              <button type="button" onClick={() => deleteHoliday(h.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClosuresSection({
  closures,
  loading,
  onSaved,
}: {
  closures: Closure[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function addClosure(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !reason.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason.trim() }),
      });
      if (res.ok) {
        setDate("");
        setReason("");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Σφάλμα");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteClosure(id: string) {
    if (!confirm("Διαγραφή;")) return;
    const res = await fetch(`/api/admin/closures/${id}`, { method: "DELETE" });
    if (res.ok) onSaved();
  }

  return (
    <section className="card-section space-y-4">
      <form onSubmit={addClosure} className="space-y-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Αιτία κλεισίματος" className="input-field" />
        <button type="submit" disabled={saving} className="btn-primary px-4 text-sm">Προσθήκη</button>
      </form>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {closures.map((c) => (
            <li key={c.id} className="py-2 flex justify-between items-center text-neutral-900 dark:text-neutral-100">
              <span>{c.date} — {c.reason}</span>
              <button type="button" onClick={() => deleteClosure(c.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Διαγραφή</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
