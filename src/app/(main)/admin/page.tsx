"use client";

import { useCallback, useEffect, useState } from "react";

type Staff = { id: string; name: string; role: string; active: boolean };
type Supplier = { id: string; name: string; defaultCategory: string };
type Holiday = { id: string; date: string; name: string };
type Closure = { id: string; date: string; reason: string };

type Tab = "staff" | "suppliers" | "holidays" | "closures";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("staff");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, sup, h, c] = await Promise.all([
      fetch("/api/admin/staff").then((r) => r.json()),
      fetch("/api/admin/suppliers").then((r) => r.json()),
      fetch("/api/admin/holidays").then((r) => r.json()),
      fetch("/api/admin/closures").then((r) => r.json()),
    ]);
    setStaff(Array.isArray(s) ? s : []);
    setSuppliers(Array.isArray(sup) ? sup : []);
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

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        {(["staff", "suppliers", "holidays", "closures"] as const).map((t) => (
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
      {tab === "holidays" && (
        <HolidaysSection holidays={holidays} loading={loading} onSaved={load} />
      )}
      {tab === "closures" && (
        <ClosuresSection closures={closures} loading={loading} onSaved={load} />
      )}
    </div>
  );
}

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

  async function toggleActive(s: Staff) {
    const res = await fetch(`/api/admin/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    if (res.ok) onSaved();
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
            <li key={s.id} className="py-2 flex justify-between items-center">
              <span className={s.active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400 line-through"}>{s.name}</span>
              <button type="button" onClick={() => toggleActive(s)} className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                {s.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
              </button>
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
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</span>
              <span className="text-neutral-500 dark:text-neutral-400 text-sm"> — {s.defaultCategory}</span>
            </li>
          ))}
        </ul>
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
