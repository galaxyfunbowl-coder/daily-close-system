import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default async function MainLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
        <nav className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-3">
            <Link href="/daily" className="font-semibold text-neutral-900 dark:text-neutral-100">
              Daily Closing
            </Link>
            <Link href="/daily" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Daily
            </Link>
            <Link href="/expenses" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Expenses
            </Link>
            <Link href="/dashboard" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Dashboard
            </Link>
            <Link href="/month" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Μήνας
            </Link>
            <Link href="/search" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Αναζήτηση
            </Link>
            <Link href="/admin" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              Admin
            </Link>
          </div>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 p-3 pb-8 text-neutral-900 dark:text-neutral-100">{children}</main>
    </div>
  );
}
