"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

type Result = { date: string; snippets: string[] };

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Αναζήτηση σημειώσεων</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Ψάξε σε σημειώσεις ημέρας και σε πληροφορίες γραμμών (π.χ. πρωταθλήματα, εκδηλώσεις).
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="π.χ. πρωταθλημα, πανελλήνιο, ονομα εκδήλωσης"
          className="input-field flex-1"
        />
        <button type="button" onClick={search} disabled={loading} className="btn-primary px-4">
          {loading ? "..." : "Αναζήτηση"}
        </button>
      </div>

      {searched && !loading && (
        results.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Δεν βρέθηκαν αποτελέσματα. Δοκίμασε άλλο όρο (τουλάχιστον 2 χαρακτήρες).</p>
        ) : (
          <section className="card-section p-0 overflow-hidden">
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {results.map((r) => (
                <li key={r.date} className="p-3">
                  <Link href={`/daily?date=${r.date}`} className="block hover:bg-neutral-50 dark:hover:bg-neutral-800/50 -m-3 p-3 rounded">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">{r.date}</div>
                    <ul className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 space-y-0.5">
                      {r.snippets.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
