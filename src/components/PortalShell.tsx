import { MapPin, Wifi } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "@/lib/blocks";

// Mobile-first themed frame shared by the captive portal and the builder preview.
// Colors come from the landing page theme; "snow" keeps true white in the admin light mode too.
export function PortalShell({ theme, title, place, children }: { theme: Theme; title: string; place?: string; children: ReactNode }) {
  const style = {
    "--primary": theme.primaryColor,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    backgroundImage: theme.backgroundImage
      ? `linear-gradient(to bottom, rgba(0,0,0,.25), ${theme.backgroundColor} 70%), url(${theme.backgroundImage})`
      : `radial-gradient(700px 420px at 15% -10%, ${theme.primaryColor}80, transparent 60%), radial-gradient(520px 380px at 110% 25%, ${theme.primaryColor}40, transparent 60%), radial-gradient(600px 400px at 50% 115%, ${theme.primaryColor}33, transparent 60%)`,
  } as CSSProperties;

  return (
    <div style={style} className="relative min-h-full overflow-hidden bg-cover bg-top bg-no-repeat font-sans">
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-[var(--primary)] opacity-20 blur-3xl" />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col gap-5 px-4 py-8">
        <header className="flex animate-fade-up flex-col items-center gap-3 text-center">
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-20 w-20 rounded-3xl object-cover shadow-2xl ring-4 ring-snow/20" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--primary)] text-snow shadow-[0_12px_40px_-10px_var(--primary)] ring-1 ring-snow/30">
              <Wifi className="h-8 w-8" strokeWidth={2.5} />
            </div>
          )}
          {place && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-snow/20 bg-snow/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <MapPin className="h-3.5 w-3.5" /> {place}
            </span>
          )}
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        </header>
        {children}
      </div>
    </div>
  );
}
