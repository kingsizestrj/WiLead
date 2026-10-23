import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { destroySession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: await requireAdmin() } });
  const openIncidents = await db.incident.count({ where: { endedAt: null } });
  return (
    <div className="app-bg flex min-h-full">
      <Sidebar userEmail={user.email} logout={logout} openIncidents={openIncidents} />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-8 lg:pt-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
