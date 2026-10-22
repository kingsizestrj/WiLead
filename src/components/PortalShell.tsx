import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "@/lib/blocks";

// Mobile-first themed frame shared by the captive portal and the builder preview.
export function PortalShell({ theme, title, children }: { theme: Theme; title: string; children: ReactNode }) {
  const style = {
    "--primary": theme.primaryColor,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    backgroundImage: theme.backgroundImage
      ? `linear-gradient(to bottom, rgba(0,0,0,.35), ${theme.backgroundColor}), url(${theme.backgroundImage})`
      : `radial-gradient(circle at 20% 0%, ${theme.primaryColor}66, transparent 55%), radial-gradient(circle at 100% 30%, ${theme.primaryColor}33, transparent 45%)`,
  } as CSSProperties;

  return (
    <div style={style} className="min-h-full bg-cover bg-top bg-no-repeat">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 px-4 py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-20 w-20 rounded-full object-cover shadow-xl ring-4 ring-white/20" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--primary)] text-3xl shadow-xl">📶</div>
          )}
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        </header>
        {children}
      </div>
    </div>
  );
}
