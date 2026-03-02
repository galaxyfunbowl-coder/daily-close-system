import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MainNav } from "@/components/MainNav";

export default async function MainLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <MainNav />
      <main className="flex-1 p-3 pb-8 text-neutral-900 dark:text-neutral-100">{children}</main>
    </div>
  );
}
