"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

const NAV_LINKS = [
  { href: "/daily", label: "Daily" },
  { href: "/expenses", label: "Expenses" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/month", label: "Μήνας" },
  { href: "/search", label: "Αναζήτηση" },
  { href: "/admin", label: "Admin" },
];

export function MainNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
      <nav className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/daily"
          className="font-semibold text-neutral-900 dark:text-neutral-100 shrink-0"
        >
          Daily Closing
        </Link>

        {/* Desktop: horizontal nav */}
        <div className="hidden md:flex items-center gap-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                pathname === href
                  ? "text-neutral-900 dark:text-neutral-100 font-medium"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Mobile: hamburger + Logout */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 -m-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
            aria-label={open ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
          <LogoutButton />
        </div>
      </nav>

      {/* Mobile: dropdown menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 right-0 top-full z-20 md:hidden border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
            <div className="flex flex-col py-2">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-3 text-sm transition-colors ${
                    pathname === href
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-100"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
