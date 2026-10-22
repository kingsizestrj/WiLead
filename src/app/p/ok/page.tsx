import { PortalShell } from "@/components/PortalShell";
import { BlocksRenderer } from "@/components/BlocksRenderer";
import type { Block, Theme } from "@/lib/blocks";
import { db } from "@/lib/db";

// Landing page after a successful hotspot login (MikroTik redirects here via `dst`).
export default async function ConnectedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const portal = params.portal
    ? await db.portal.findUniqueOrThrow({ where: { id: params.portal } })
    : await db.portal.findFirstOrThrow({ where: { isDefault: true } });
  const next = portal.redirectUrl || params.dst;
  const handle = portal.instagram?.replace("@", "");

  return (
    <PortalShell theme={portal.theme as Theme} title="Você está conectado! 🎉">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-snow/15 bg-black/30 p-6 text-center backdrop-blur-xl">
        <p className="opacity-90">Aproveite a internet. Gostou do lugar? Conta pra todo mundo!</p>
        {handle && (
          <a href={`https://instagram.com/${handle}`}
            className="rounded-2xl bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] px-4 py-4 text-lg font-bold text-snow">
            Seguir @{handle} no Instagram
          </a>
        )}
        {next && (
          <a href={next} className="rounded-2xl bg-snow/15 px-4 py-3 font-semibold">
            Continuar navegando
          </a>
        )}
      </div>
      <BlocksRenderer blocks={portal.blocks as Block[]} />
    </PortalShell>
  );
}
