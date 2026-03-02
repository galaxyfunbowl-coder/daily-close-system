"use client";

import { useCallback, useEffect, useState } from "react";
import { OPERATOR_LABELS } from "@/lib/constants";
import type { ElectronicOperator } from "@prisma/client";

type DashboardData = {
  month: string;
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  totalPOS: number;
  partyRevenue: number;
  partyCount: number;
  bowlingBySubLabel: Record<string, number>;
  electronicByOperator: Record<string, number>;
  playgroundTotal: number;
  billiardsTotal: number;
  posDiffDays: { date: string; diff: number }[];
  yoy: {
    revenue: number;
    expenses: number;
    net: number;
    partyRevenue: number;
  };
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?month=${m}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  function exportCsv() {
    window.open(`/api/dashboard/export?month=${month}`, "_blank");
  }

  async function backup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (d.ok) alert("Backup ολοκληρώθηκε στο φάκελο backups.");
      else alert(d.error ?? "Σφάλμα");
    } finally {
      setBackupLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded bg-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-300"
        >
          Export μήνα σε CSV
        </button>
        <button
          type="button"
          onClick={backup}
          disabled={backupLoading}
          className="rounded bg-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-300 disabled:opacity-50"
        >
          {backupLoading ? "..." : "Backup βάσης"}
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500">Φόρτωση...</p>
      ) : !data ? (
        <p className="text-neutral-500">Δεν βρέθηκαν δεδομένα</p>
      ) : (
        <>
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-medium text-neutral-700">Σύνολα μήνα</h2>
            <ul className="space-y-1 text-sm">
              <li><strong>Έσοδα:</strong> {data.totalRevenue.toFixed(2)} €</li>
              <li><strong>Έξοδα:</strong> {data.totalExpenses.toFixed(2)} €</li>
              <li><strong>Καθαρά:</strong> {data.netResult.toFixed(2)} €</li>
              <li><strong>POS σύνολο:</strong> {data.totalPOS.toFixed(2)} €</li>
              <li><strong>Έσοδα πάρτυ:</strong> {data.partyRevenue.toFixed(2)} €</li>
              <li><strong>Αριθμός πάρτυ:</strong> {data.partyCount}</li>
            </ul>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-medium text-neutral-700">Reception-Bowling ανά SubLabel</h2>
            {Object.keys(data.bowlingBySubLabel).length === 0 ? (
              <p className="text-neutral-500 text-sm">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(data.bowlingBySubLabel).map(([k, v]) => (
                  <li key={k}>{k}: {v.toFixed(2)} €</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-medium text-neutral-700">Ηλεκτρονικά ανά Operator</h2>
            {Object.keys(data.electronicByOperator).length === 0 ? (
              <p className="text-neutral-500 text-sm">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(data.electronicByOperator).map(([k, v]) => (
                  <li key={k}>
                    {OPERATOR_LABELS[k as ElectronicOperator] ?? k}: {v.toFixed(2)} €
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-medium text-neutral-700">Παιδότοπος / Μπιλιάρδα</h2>
            <ul className="space-y-1 text-sm">
              <li>Παιδότοπος: {data.playgroundTotal.toFixed(2)} €</li>
              <li>Μπιλιάρδα: {data.billiardsTotal.toFixed(2)} €</li>
            </ul>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-medium text-neutral-700">Σύγκριση YoY (ίδιος μήνας πέρυσι)</h2>
            <ul className="space-y-1 text-sm">
              <li>Έσοδα πέρυσι: {data.yoy.revenue.toFixed(2)} €</li>
              <li>Έξοδα πέρυσι: {data.yoy.expenses.toFixed(2)} €</li>
              <li>Καθαρά πέρυσι: {data.yoy.net.toFixed(2)} €</li>
              <li>Έσοδα πάρτυ πέρυσι: {data.yoy.partyRevenue.toFixed(2)} €</li>
            </ul>
          </section>

          {data.posDiffDays.length > 0 && (
            <section className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
              <h2 className="mb-3 font-medium text-red-800">Έλεγχος POS — ημέρες με διαφορά</h2>
              <ul className="space-y-1 text-sm text-red-800">
                {data.posDiffDays.map(({ date, diff }) => (
                  <li key={date}>{date}: διαφορά {diff.toFixed(2)} €</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
