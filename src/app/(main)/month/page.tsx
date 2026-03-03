"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format-amount";

const MONTH_NAMES = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
const WEEKDAY = ["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"];

type DayRow = {
  date: string;
  notes: string;
  isClosed: boolean;
  totalRevenue: number;
  zPosTotal: number | null;
  zCashTotal: number | null;
  partyCount: number;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function weekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAY[d.getDay()];
}

export default function MonthPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [y, m] = month.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  const load = useCallback(async (mStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/month-days?month=${mStr}`);
      if (res.ok) {
        const data = await res.json();
        setDays(data.days ?? []);
      } else {
        setDays([]);
      }
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Μήνας — μέρα μέρα</h1>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={m}
          onChange={(e) => setMonth(`${y}-${String(Number(e.target.value)).padStart(2, "0")}`)}
          className="input-field py-2 text-sm w-auto min-w-[140px]"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={y}
          onChange={(e) => setMonth(`${e.target.value}-${String(m).padStart(2, "0")}`)}
          className="input-field py-2 text-sm w-auto min-w-[100px]"
        >
          {years.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Φόρτωση...</p>
      ) : days.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400">Δεν υπάρχουν καταχωρήσεις για αυτόν τον μήνα.</p>
      ) : (
        <section className="card-section p-0 overflow-hidden">
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {days.map((d) => (
              <li key={d.date} className="p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 flex items-start gap-2">
                <Link href={`/daily?date=${d.date}`} className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{d.date}</span>
                      <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">{weekday(d.date)}</span>
                      {d.isClosed && (
                        <span className="ml-2 text-xs bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 px-1.5 py-0.5 rounded">Κλειστό</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{formatAmount(d.totalRevenue)} €</span>
                  </div>
                  {d.notes && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{d.notes}</p>
                  )}
                  <div className="mt-1 flex gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {d.zPosTotal != null && <span>POS: {formatAmount(d.zPosTotal)} €</span>}
                    {d.zCashTotal != null && <span>Μετρητά: {formatAmount(d.zCashTotal)} €</span>}
                    {d.partyCount > 0 && <span>Πάρτυ: {d.partyCount}</span>}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm(`Διαγραφή ημέρας ${d.date}; Σίγουρα;`)) return;
                    const res = await fetch(`/api/days/${d.date}`, { method: "DELETE" });
                    if (res.ok) {
                      load(month);
                      router.refresh();
                    } else alert("Σφάλμα διαγραφής");
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline shrink-0"
                >
                  Διαγραφή
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
