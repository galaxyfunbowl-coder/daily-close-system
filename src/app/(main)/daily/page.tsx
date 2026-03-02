"use client";

import { useCallback, useEffect, useState } from "react";
import type { Department, ElectronicOperator, PaymentMethod } from "@prisma/client";
import {
  DEPARTMENT_LABELS,
  OPERATOR_LABELS,
  BOWLING_SUBLABELS,
  ELECTRONIC_OPERATORS,
} from "@/lib/constants";

type Staff = { id: string; name: string };

type RevenueLineRow = {
  id: string;
  department: Department;
  subLabel: string | null;
  staffId: string | null;
  staffName: string | null;
  operator: ElectronicOperator | null;
  total: number;
  pos: number;
  cash: number;
};

type PartyRow = {
  id: string;
  staffId: string;
  staffName: string;
  total: number;
  paymentMethod: PaymentMethod;
  posInput: number | null;
  posComputed: number;
  cashComputed: number;
  notes: string;
};

type DayData = {
  id: string;
  date: string;
  notes: string;
  isClosed: boolean;
  zPosTotal: number | null;
  zCashTotal: number | null;
  revenueLines: RevenueLineRow[];
  partyEvents: PartyRow[];
};

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"];
  return days[d.getDay()];
}

export default function DailyPage() {
  const [date, setDate] = useState(todayISO);
  const [day, setDay] = useState<DayData | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDay = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/days/${d}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load");
      }
      const data = await res.json();
      setDay(data.day);
      setStaff(data.staff ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDay(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(date);
  }, [date, loadDay]);

  function updateDay(fields: Partial<DayData>) {
    if (!day) return;
    setDay({ ...day, ...fields });
  }

  function updateRevenueLine(index: number, fields: Partial<RevenueLineRow>) {
    if (!day) return;
    const next = [...day.revenueLines];
    next[index] = { ...next[index], ...fields };
    if (fields.total !== undefined && fields.pos === undefined) {
      next[index].cash = Math.max(0, next[index].total - next[index].pos);
    }
    if (fields.pos !== undefined) {
      next[index].cash = Math.max(0, next[index].total - fields.pos);
    }
    setDay({ ...day, revenueLines: next });
  }

  function addBowlingLine() {
    if (!day) return;
    setDay({
      ...day,
      revenueLines: [
        ...day.revenueLines,
        {
          id: `new-${Date.now()}`,
          department: "RECEPTION_BOWLING" as Department,
          subLabel: "Regular",
          staffId: null,
          staffName: null,
          operator: null,
          total: 0,
          pos: 0,
          cash: 0,
        },
      ],
    });
  }

  function addRevenueLine() {
    if (!day) return;
    setDay({
      ...day,
      revenueLines: [
        ...day.revenueLines,
        {
          id: `new-${Date.now()}`,
          department: "RECEPTION_BOWLING" as Department,
          subLabel: "Regular",
          staffId: null,
          staffName: null,
          operator: null,
          total: 0,
          pos: 0,
          cash: 0,
        },
      ],
    });
  }

  function removeRevenueLine(index: number) {
    if (!day) return;
    const next = day.revenueLines.filter((_, i) => i !== index);
    setDay({ ...day, revenueLines: next });
  }

  function updateParty(index: number, fields: Partial<PartyRow>) {
    if (!day) return;
    const next = [...day.partyEvents];
    next[index] = { ...next[index], ...fields };
    const pm = next[index].paymentMethod;
    next[index].posComputed =
      pm === "CASH" ? 0 : pm === "CARD" ? next[index].total : next[index].posInput ?? 0;
    next[index].cashComputed = next[index].total - next[index].posComputed;
    setDay({ ...day, partyEvents: next });
  }

  function addParty() {
    if (!day || staff.length === 0) return;
    setDay({
      ...day,
      partyEvents: [
        ...day.partyEvents,
        {
          id: `new-${Date.now()}`,
          staffId: staff[0].id,
          staffName: staff[0].name,
          total: 0,
          paymentMethod: "CARD" as PaymentMethod,
          posInput: null,
          posComputed: 0,
          cashComputed: 0,
          notes: "",
        },
      ],
    });
  }

  function removeParty(index: number) {
    if (!day) return;
    setDay({ ...day, partyEvents: day.partyEvents.filter((_, i) => i !== index) });
  }

  const calculatedPOS =
    day?.revenueLines.reduce((s, r) => s + r.pos, 0) ?? 0;
  const partyPOS = day?.partyEvents.reduce((s, p) => s + p.posComputed, 0) ?? 0;
  const calculatedTotalPOS = calculatedPOS + partyPOS;
  const zPosTotal = day?.zPosTotal ?? null;
  const posDiff = zPosTotal != null ? zPosTotal - calculatedTotalPOS : null;

  async function save() {
    if (!day) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/days/${day.date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: day.notes,
          isClosed: day.isClosed,
          zPosTotal: day.zPosTotal,
          zCashTotal: day.zCashTotal,
          revenueLines: day.revenueLines.map((r) => ({
            department: r.department,
            subLabel: r.subLabel,
            staffId: r.staffId,
            operator: r.operator,
            total: r.total,
            pos: r.pos,
            cash: r.cash,
          })),
          partyEvents: day.partyEvents.map((p) => ({
            staffId: p.staffId,
            total: p.total,
            paymentMethod: p.paymentMethod,
            posInput: p.paymentMethod === "SPLIT" ? p.posInput : null,
            notes: p.notes,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !day) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      </div>
    );
  }

  if (!day) {
    return (
      <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200">
        {error || "Δεν βρέθηκε ημέρα"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Καθημερινό Κλείσιμο</h1>

      {/* SECTION A — GENERAL */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Γενικά</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Ημερομηνία</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field mt-1"
            />
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{weekdayLabel(date)}</p>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Σημειώσεις</label>
            <input
              type="text"
              value={day.notes}
              onChange={(e) => updateDay({ notes: e.target.value })}
              placeholder="Προαιρετικό"
              className="input-field mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={day.isClosed}
              onChange={(e) => updateDay({ isClosed: e.target.checked })}
              className="rounded border-neutral-300 dark:border-neutral-600 dark:bg-neutral-700"
            />
            <span className="text-sm">Κλειστό</span>
          </label>
        </div>
      </section>

      {/* SECTION B — Z CONTROL */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Έλεγχος Z</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Z POS Σύνολο (απαιτείται)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={day.zPosTotal ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateDay({ zPosTotal: v === "" ? null : parseFloat(v) || 0 });
              }}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Z Μετρητά (προαιρετικό)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={day.zCashTotal ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateDay({ zCashTotal: v === "" ? null : parseFloat(v) || 0 });
              }}
              className="input-field mt-1"
            />
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Υπολογισμένο POS (γραμμές + πάρτυ): <strong>{calculatedTotalPOS.toFixed(2)}</strong>
          </p>
          {posDiff !== null && Math.abs(posDiff) > 0.001 && (
            <div className="rounded border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950 p-3 text-red-800 dark:text-red-200">
              <strong>Διαφορά POS:</strong> {posDiff.toFixed(2)}
            </div>
          )}
        </div>
      </section>

      {/* SECTION C — REVENUE LINES */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Έσοδα</h2>
        <div className="space-y-4">
          {day.revenueLines.map((line, idx) => (
            <div
              key={line.id}
              className="rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {line.department === "RECEPTION_BOWLING" && line.subLabel
                    ? `${DEPARTMENT_LABELS.RECEPTION_BOWLING} — ${line.subLabel}`
                    : line.department === "ELECTRONIC_GAMES" && line.operator
                      ? `${DEPARTMENT_LABELS.ELECTRONIC_GAMES} — ${OPERATOR_LABELS[line.operator]}`
                      : DEPARTMENT_LABELS[line.department] ?? line.department}
                </span>
                {day.revenueLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRevenueLine(idx)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Αφαίρεση
                  </button>
                )}
              </div>
              {line.department === "RECEPTION_BOWLING" && (
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">SubLabel</label>
                  <select
                    value={line.subLabel ?? "Regular"}
                    onChange={(e) => updateRevenueLine(idx, { subLabel: e.target.value })}
                    className="input-field mt-1 py-1.5 text-sm"
                  >
                    {BOWLING_SUBLABELS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              {(line.department === "PAIDOTOPOS" || line.department === "BILIARDA") && (
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">Υπεύθυνος</label>
                  <select
                    value={line.staffId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const s = staff.find((x) => x.id === id);
                      updateRevenueLine(idx, {
                        staffId: id || null,
                        staffName: s?.name ?? null,
                      });
                    }}
                    className="input-field mt-1 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {line.department === "ELECTRONIC_GAMES" && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {line.operator ? OPERATOR_LABELS[line.operator] : "—"}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">Σύνολο</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.total || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      updateRevenueLine(idx, { total: v, cash: Math.max(0, v - line.pos) });
                    }}
                    className="input-field py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">POS</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.pos || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      updateRevenueLine(idx, { pos: v, cash: Math.max(0, line.total - v) });
                    }}
                    className="input-field py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">Μετρητά</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.cash.toFixed(2)}
                    readOnly
                    className="w-full rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addBowlingLine}
              className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-1.5 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100"
            >
              + Γραμμή Bowling
            </button>
            <button
              type="button"
              onClick={addRevenueLine}
              className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-1.5 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100"
            >
              + Γραμμή Έσοδων
            </button>
          </div>
        </div>
      </section>

      {/* SECTION D — PARTIES */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Παιδικά Πάρτυ / Εκδηλώσεις</h2>
        <div className="space-y-4">
          {day.partyEvents.map((ev, idx) => (
            <div
              key={ev.id}
              className="rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-3 space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Πάρτυ #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeParty(idx)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Αφαίρεση
                </button>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Υπεύθυνος</label>
                <select
                  value={ev.staffId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const s = staff.find((x) => x.id === id);
                    updateParty(idx, { staffId: id, staffName: s?.name ?? "" });
                  }}
                  className="input-field mt-1 py-1.5 text-sm"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Σύνολο</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ev.total || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    updateParty(idx, { total: v });
                  }}
                  className="input-field mt-1 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Τρόπος πληρωμής</label>
                <select
                  value={ev.paymentMethod}
                  onChange={(e) =>
                    updateParty(idx, {
                      paymentMethod: e.target.value as PaymentMethod,
                      posInput: null,
                    })
                  }
                  className="input-field mt-1 py-1.5 text-sm"
                >
                  <option value="CASH">Μετρητά</option>
                  <option value="CARD">Κάρτα</option>
                  <option value="SPLIT">Split</option>
                </select>
              </div>
              {ev.paymentMethod === "SPLIT" && (
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">POS (μέρος split)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ev.posInput ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : parseFloat(e.target.value) || 0;
                      updateParty(idx, { posInput: v });
                    }}
                    className="input-field mt-1 py-1.5 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Σημειώσεις</label>
                <input
                  type="text"
                  value={ev.notes}
                  onChange={(e) => updateParty(idx, { notes: e.target.value })}
                  className="input-field mt-1 py-1.5 text-sm"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addParty}
            disabled={staff.length === 0}
            className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-1.5 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
          >
            + Πάρτυ / Εκδήλωση
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 bg-white/95 dark:bg-neutral-900/95 py-3 border-t border-neutral-200 dark:border-neutral-700 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary w-full py-3"
        >
          {saving ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </div>
    </div>
  );
}
