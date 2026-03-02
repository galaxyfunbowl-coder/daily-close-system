"use client";

import { useCallback, useEffect, useState } from "react";
import { OPERATOR_LABELS } from "@/lib/constants";
import type { ElectronicOperator } from "@prisma/client";

type DashboardData = {
  month: string;
  totalRevenue: number;
  totalExpenses: number;
  payrollTotal: number;
  fixedTotal: number;
  staffTotals: { staffId: string; staffName: string; total: number }[];
  netResult: number;
  totalPOS: number;
  totalCash: number;
  partyRevenue: number;
  partyCount: number;
  bowlingBySubLabel: Record<string, number>;
  electronicByOperator: Record<string, number>;
  playgroundTotal: number;
  billiardsTotal: number;
  barTotal: number;
  serviceTotal: number;
  proshopTotal: number;
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

const MONTH_NAMES = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

function getYearMonth(ym: string): { year: number; monthNum: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, monthNum: m };
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const { year, monthNum } = getYearMonth(month);
  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const setYearMonth = (y: number, m: number) => setMonth(`${y}-${String(m).padStart(2, "0")}`);

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
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <select
            value={monthNum}
            onChange={(e) => setYearMonth(year, Number(e.target.value))}
            className="input-field py-2 text-sm w-auto min-w-[140px]"
            title="Επιλογή μήνα"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYearMonth(Number(e.target.value), monthNum)}
            className="input-field py-2 text-sm w-auto min-w-[100px]"
            title="Επιλογή έτους"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportCsv} className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-2 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100">
          Export μήνα σε CSV
        </button>
        <button type="button" onClick={backup} disabled={backupLoading} className="rounded bg-neutral-200 dark:bg-neutral-600 px-3 py-2 text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-500 text-neutral-900 dark:text-neutral-100 disabled:opacity-50">
          {backupLoading ? "..." : "Backup βάσης"}
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : !data ? (
        <p className="text-neutral-500 dark:text-neutral-400">Δεν βρέθηκαν δεδομένα</p>
      ) : (
        <>
          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Σύνολα μήνα</h2>
            <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              <li><strong>Έσοδα:</strong> {data.totalRevenue.toFixed(2)} €</li>
              <li><strong>Έξοδα:</strong> {data.totalExpenses.toFixed(2)} €</li>
              {data.payrollTotal > 0 && (
                <li className="text-neutral-600 dark:text-neutral-400">— Μισθοδοσία: {data.payrollTotal.toFixed(2)} €</li>
              )}
              {data.fixedTotal > 0 && (
                <li className="text-neutral-600 dark:text-neutral-400">— Πάγια έξοδα: {data.fixedTotal.toFixed(2)} €</li>
              )}
              <li><strong>Καθαρά:</strong> {data.netResult.toFixed(2)} €</li>
              <li><strong>POS σύνολο (από Z):</strong> {data.totalPOS.toFixed(2)} €</li>
              <li><strong>Μετρητά σύνολο (από Z):</strong> {data.totalCash.toFixed(2)} €</li>
            </ul>
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Reception-Bowling ανά SubLabel</h2>
            {Object.keys(data.bowlingBySubLabel).length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">—</p>
            ) : (
              <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                {Object.entries(data.bowlingBySubLabel).map(([k, v]) => (
                  <li key={k}>{k}: {v.toFixed(2)} €</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Ηλεκτρονικά ανά Operator</h2>
            {Object.keys(data.electronicByOperator).length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">—</p>
            ) : (
              <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                {Object.entries(data.electronicByOperator).map(([k, v]) => (
                  <li key={k}>{OPERATOR_LABELS[k as ElectronicOperator] ?? k}: {v.toFixed(2)} €</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Παιδότοπος / Μπιλιάρδα / Bar / Service / ProShop</h2>
            <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              <li>Παιδότοπος: {data.playgroundTotal.toFixed(2)} €</li>
              <li>Μπιλιάρδα: {data.billiardsTotal.toFixed(2)} €</li>
              <li>Bar: {data.barTotal.toFixed(2)} €</li>
              <li>Service: {data.serviceTotal.toFixed(2)} €</li>
              <li>ProShop: {data.proshopTotal.toFixed(2)} €</li>
            </ul>
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Πάρτυ — Εκδηλώσεις</h2>
            <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              <li>Έσοδα πάρτυ: {data.partyRevenue.toFixed(2)} €</li>
              <li>Αριθμός πάρτυ: {data.partyCount}</li>
            </ul>
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Ταμείο ανά σερβιτόρο</h2>
            {data.staffTotals.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">—</p>
            ) : (
              <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                {data.staffTotals.map((s) => (
                  <li key={s.staffId}>{s.staffName}: {s.total.toFixed(2)} €</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-section">
            <h2 className="mb-3 font-medium text-neutral-700 dark:text-neutral-300">Σύγκριση YoY (ίδιος μήνας πέρυσι)</h2>
            <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              <li>Έσοδα πέρυσι: {data.yoy.revenue.toFixed(2)} €</li>
              <li>Έξοδα πέρυσι: {data.yoy.expenses.toFixed(2)} €</li>
              <li>Καθαρά πέρυσι: {data.yoy.net.toFixed(2)} €</li>
              <li>Έσοδα πάρτυ πέρυσι: {data.yoy.partyRevenue.toFixed(2)} €</li>
            </ul>
          </section>

        </>
      )}
    </div>
  );
}
