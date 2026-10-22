import Link from "next/link";
import { redirect } from "next/navigation";
import { destroySession, requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/acessos", label: "Acessos", icon: "📶" },
  { href: "/admin/paginas", label: "Landing pages", icon: "🎨" },
  { href: "/admin/locais", label: "Locais", icon: "📍" },
  { href: "/admin/roteadores", label: "MikroTik", icon: "🛜" },
  { href: "/admin/config", label: "Configurações", icon: "⚙️" },
];

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-full bg-slate-50">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-950 p-4 text-slate-300 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 text-lg font-bold text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-600">📶</span> Voltec Hotspot
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/10 hover:text-white">
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10">Sair</button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto bg-slate-950 p-2 md:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-200">
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <main className="w-full max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
