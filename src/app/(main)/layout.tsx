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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <nav className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-3">
            <Link href="/daily" className="font-semibold text-neutral-900">
              Daily Closing
            </Link>
            <Link href="/daily" className="text-sm text-neutral-600 hover:text-neutral-900">
              Daily
            </Link>
            <Link href="/expenses" className="text-sm text-neutral-600 hover:text-neutral-900">
              Expenses
            </Link>
            <Link href="/dashboard" className="text-sm text-neutral-600 hover:text-neutral-900">
              Dashboard
            </Link>
            <Link href="/admin" className="text-sm text-neutral-600 hover:text-neutral-900">
              Admin
            </Link>
          </div>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 p-3 pb-8">{children}</main>
    </div>
  );
}
