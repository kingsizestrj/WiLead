"use client";

import {
  Activity,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquareText,
  Moon,
  Palette,
  Router,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./ui";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/acessos", label: "Acessos", icon: Activity },
  { href: "/admin/paginas", label: "Landing pages", icon: Palette },
  { href: "/admin/templates", label: "Templates WhatsApp", icon: MessageSquareText },
  { href: "/admin/locais", label: "Locais", icon: MapPin },
  { href: "/admin/roteadores", label: "MikroTik", icon: Router },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];

export function Sidebar({ userEmail, logout }: { userEmail: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.classList.contains("light")), []);

  const toggleTheme = () => {
    const next = !light;
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("wilead_theme", next ? "light" : "dark");
    } catch {
      /* armazenamento indisponível */
    }
    setLight(next);
  };

  const nav = (
    <nav className="mt-10 flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              active ? "bg-brand-soft text-white ring-1 ring-fuchsia-500/30" : "text-ink-300 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${active ? "text-fuchsia-300" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="glass flex items-center gap-2 rounded-2xl p-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold uppercase text-snow">{userEmail.charAt(0)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{userEmail}</div>
        <div className="text-[11px] text-ink-400">Administrador</div>
      </div>
      <button onClick={toggleTheme} title={light ? "Modo escuro" : "Modo claro"} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-white">
        {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      <form action={logout}>
        <button title="Sair" className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-white">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/5 bg-ink-950/60 p-5 backdrop-blur-xl lg:flex">
        <div>
          <Logo subtitle="Wi-Fi que vira cliente" />
          {nav}
        </div>
        {userBox}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-white/5 bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/5" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-72 flex-col justify-between bg-ink-900 p-5">
            <div>
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
            </div>
            {userBox}
          </aside>
        </div>
      )}
    </>
  );
}
