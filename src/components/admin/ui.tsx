import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-ink-900/70 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-400 outline-none transition focus:border-fuchsia-500/60 focus:ring-4 focus:ring-fuchsia-500/10";
export const fieldClass = "flex flex-col gap-1.5 text-xs font-semibold text-ink-300";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-snow shadow-glow transition hover:brightness-110 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50";
export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.07] active:scale-[.98] disabled:pointer-events-none disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25";

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl shadow-glow ring-1 ring-white/25" />
      <div>
        <div className="text-lg font-extrabold leading-none tracking-tight">WiLead</div>
        {subtitle && <div className="mt-1 text-[11px] text-ink-400">{subtitle}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon, children, className = "" }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass animate-fade-up rounded-2xl p-5 ${className}`}>
      {title && (
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          {icon && <span className="text-fuchsia-300">{icon}</span>}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon, accent = "bg-fuchsia-500" }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; accent?: string }) {
  return (
    <div className="glass relative animate-fade-up overflow-hidden rounded-2xl p-5">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl ${accent}`} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">{label}</span>
        <span className="text-ink-300">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "amber" | "rose" | "sky" | "fuchsia" | "zinc"; children: ReactNode }) {
  const tones = {
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    zinc: "bg-white/5 text-ink-300 border-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-fuchsia-300">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-300">{text}</p>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="glass animate-fade-up overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/5 text-[11px] uppercase tracking-wider text-ink-300">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "whitespace-nowrap px-4 py-3";
