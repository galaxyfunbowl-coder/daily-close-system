"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Department, PaymentMethod } from "@prisma/client";
import { DEPARTMENT_LABELS, BOWLING_SUBLABELS } from "@/lib/constants";
import { formatAmount } from "@/lib/format-amount";

type Staff = { id: string; name: string };
type ElectronicOperatorOption = { id: string; name: string };

type RevenueLineRow = {
  id: string;
  department: Department;
  subLabel: string | null;
  subLabelInfo: string | null;
  staffId: string | null;
  staffName: string | null;
  operatorId: string | null;
  operatorName: string | null;
  total: number;
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [date, setDate] = useState(() => {
    const p = searchParams.get("date");
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    return todayISO();
  });
  const [day, setDay] = useState<DayData | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [electronicOperators, setElectronicOperators] = useState<ElectronicOperatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMyData, setSyncingMyData] = useState(false);
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
      setElectronicOperators(data.electronicOperators ?? []);
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

  function addElectronicLine() {
    if (!day) return;
    const newLine: RevenueLineRow = {
      id: `new-${Date.now()}`,
      department: "ELECTRONIC_GAMES",
      subLabel: null,
      subLabelInfo: null,
      staffId: null,
      staffName: null,
      operatorId: null,
      operatorName: null,
      total: 0,
      cash: 0,
    };
    setDay({
      ...day,
      revenueLines: [...day.revenueLines, newLine],
    });
  }

  function updateRevenueLine(index: number, fields: Partial<RevenueLineRow>) {
    if (!day) return;
    const next = [...day.revenueLines];
    next[index] = { ...next[index], ...fields };
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
          subLabelInfo: null,
          staffId: null,
          staffName: null,
          operatorId: null,
          operatorName: null,
          total: 0,
          cash: 0,
        },
      ],
    });
  }

  function addRevenueLineByType(
    type: "PAIDOTOPOS" | "BILIARDA" | "BAR" | "SERVICE" | "PROSHOP"
  ) {
    if (!day) return;
    const newLine: RevenueLineRow = {
      id: `new-${Date.now()}`,
          department: type,
      subLabel: null,
      subLabelInfo: null,
      staffId: null,
      staffName: null,
      operatorId: null,
      operatorName: null,
      total: 0,
      cash: 0,
    };
    setDay({
      ...day,
      revenueLines: [...day.revenueLines, newLine],
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
          paymentMethod: "CASH" as PaymentMethod,
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

  async function importMyDataExpenses() {
    setSyncingMyData(true);
    setError("");
    try {
      const res = await fetch("/api/mydata/sync-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom: date, dateTo: date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Σφάλμα sync myDATA");
        return;
      }
      const msg = `myDATA: ${data.fetched} τιμολόγια — ${data.inserted} νέα, ${data.updated} ενημερωμένα`;
      alert(msg);
      if (data.fetched > 0 || data.inserted > 0 || data.updated > 0) {
        router.push("/expenses");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Σφάλμα δικτύου");
    } finally {
      setSyncingMyData(false);
    }
  }

  const totalRevenueFromLines =
    day?.revenueLines.reduce((s, r) => s + r.total, 0) ?? 0;
  const totalRevenueFromParties =
    day?.partyEvents.reduce((s, p) => s + p.total, 0) ?? 0;
  const totalRevenueDay = totalRevenueFromLines + totalRevenueFromParties;
  const zPos = day?.zPosTotal ?? 0;
  const calculatedCash = Math.max(0, totalRevenueDay - zPos);

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
          zCashTotal: totalRevenueDay - (day.zPosTotal ?? 0),
          revenueLines: day.revenueLines.map((r) => ({
            department: r.department,
            subLabel: r.subLabel,
            subLabelInfo: r.subLabelInfo,
            staffId: r.staffId,
            operatorId: r.operatorId,
            total: r.total,
          })),
          partyEvents: day.partyEvents.map((p) => ({
            staffId: p.staffId,
            total: p.total,
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

      {/* SECTION — myDATA IMPORT */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Έξοδα</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          Εισαγωγή εξόδων από myDATA για την ημέρα {date}.
        </p>
        <button
          type="button"
          onClick={importMyDataExpenses}
          disabled={syncingMyData}
          className="rounded bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {syncingMyData ? "Συγχρονισμός..." : "Εισαγωγή εξόδων από myDATA"}
        </button>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          <a href={`/expenses`} className="text-blue-600 dark:text-blue-400 hover:underline">
            Δείτε όλα τα εξόδα →
          </a>
        </p>
      </section>

      {/* SECTION A — GENERAL */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Γενικά</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">Ημερομηνία</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                  router.replace(`/daily?date=${next}`);
                }
              }}
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
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Διαγραφή ολόκληρης της ημέρας ${day.date}; Δεν γίνεται αναίρεση. Σίγουρα;`)) return;
                const res = await fetch(`/api/days/${day.date}`, { method: "DELETE" });
                if (res.ok) {
                  router.push("/month");
                  router.refresh();
                } else {
                  const data = await res.json().catch(() => ({}));
                  setError(data.error ?? "Σφάλμα διαγραφής");
                }
              }}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Διαγραφή ημέρας
            </button>
          </div>
        </div>
      </section>

      {/* SECTION B — Z: μόνο POS από το μηχάνημα· μετρητά = έσοδα − POS */}
      <section className="card-section">
        <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Z — Σύνολα ημέρας</h2>
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Συνολικά έσοδα (από γραμμές + πάρτυ): <strong>{formatAmount(totalRevenueDay)} €</strong>
          </p>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">POS σύνολο (από το Z)</label>
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
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Μετρητά (υπολογισμένα): <strong>{formatAmount(calculatedCash)} €</strong>
          </p>
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
                    ? `${DEPARTMENT_LABELS.RECEPTION_BOWLING} — ${line.subLabel}${line.subLabelInfo ? ` — ${line.subLabelInfo}` : ""}`
                    : line.department === "ELECTRONIC_GAMES" && (line.operatorId || line.operatorName)
                      ? `${DEPARTMENT_LABELS.ELECTRONIC_GAMES} — ${line.operatorName ?? electronicOperators.find((o) => o.id === line.operatorId)?.name ?? "—"}`
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
                <>
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400">Τύπος</label>
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
                  {line.subLabel && line.subLabel !== "Regular" && (
                    <div>
                      <label className="block text-xs text-neutral-500 dark:text-neutral-400">Πληροφορία (π.χ. Εσωτερικό πρωταθλημα, Πανελλήνιο, ονομασία εκδήλωσης)</label>
                      <input
                        type="text"
                        value={line.subLabelInfo ?? ""}
                        onChange={(e) => updateRevenueLine(idx, { subLabelInfo: e.target.value || null })}
                        placeholder="π.χ. Εσωτερικό πρωταθλημα, Πανελλήνιο πρωταθλημα"
                        className="input-field mt-1 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </>
              )}
              {(["PAIDOTOPOS", "BILIARDA", "BAR", "SERVICE", "PROSHOP"] as readonly string[]).includes(line.department) && (
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
                <div className="space-y-1">
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">Λειτουργός / Εταιρεία Ηλεκτρονικών</label>
                  <select
                    value={line.operatorId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      updateRevenueLine(idx, {
                        operatorId: id,
                        operatorName: id ? electronicOperators.find((o) => o.id === id)?.name ?? null : null,
                      });
                    }}
                    className="input-field mt-1 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {electronicOperators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Σύνολο (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.total || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    updateRevenueLine(idx, { total: v });
                  }}
                  className="input-field py-1.5 text-sm"
                />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addBowlingLine}
              className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-1.5 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100"
            >
              + Γραμμή Bowling
            </button>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">ή ξαναπρόσθεσε:</span>
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v === "PAIDOTOPOS") addRevenueLineByType("PAIDOTOPOS");
                else if (v === "BILIARDA") addRevenueLineByType("BILIARDA");
                else if (v === "BAR") addRevenueLineByType("BAR");
                else if (v === "SERVICE") addRevenueLineByType("SERVICE");
                else if (v === "PROSHOP") addRevenueLineByType("PROSHOP");
                else if (v === "ELECTRONIC") addElectronicLine();
                e.target.value = "";
              }}
              className="input-field py-1.5 text-sm w-auto min-w-[180px]"
              title="Π.χ. αν αφαιρέσεις Παιδότοπο, Μπιλιάρδα, Bar, Service ή Ηλεκτρονικά"
            >
              <option value="">Προσθήκη γραμμής...</option>
              <option value="PAIDOTOPOS">Παιδότοπος</option>
              <option value="BILIARDA">Μπιλιάρδα</option>
              <option value="BAR">Bar</option>
              <option value="SERVICE">Service</option>
              <option value="PROSHOP">ProShop</option>
              <option value="ELECTRONIC">Ηλεκτρονικά</option>
            </select>
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
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">Σύνολο (€)</label>
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
