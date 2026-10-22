import Link from "next/link";
import { Card, PageHeader, buttonClass, ghostButtonClass } from "@/components/admin/ui";
import type { Theme } from "@/lib/blocks";
import { db } from "@/lib/db";
import { createPortal, deletePortal, duplicatePortal, setDefaultPortal } from "../actions";

export default async function PortalsPage() {
  const portals = await db.portal.findMany({
    orderBy: { createdAt: "asc" },
    include: { locations: true, _count: { select: { events: true } } },
  });
  return (
    <>
      <PageHeader
        title="Landing pages"
        subtitle="Monte a página que o cliente vê ao conectar: banners, vídeos, cupons e Instagram."
        actions={<form action={createPortal}><button className={buttonClass}>+ Nova landing page</button></form>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portals.map((p) => {
          const theme = p.theme as Theme;
          return (
            <Card key={p.id} className="flex flex-col gap-3">
              <div className="h-28 rounded-xl" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.backgroundColor})` }} />
              <div>
                <h3 className="font-semibold">
                  {p.name} {p.isDefault && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">padrão</span>}
                </h3>
                <p className="text-xs text-slate-500">
                  {p.locations.length ? p.locations.map((l) => l.name).join(", ") : p.isDefault ? "Locais sem página definida" : "Nenhum local"}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href={`/admin/paginas/${p.id}`} className={buttonClass}>Editar</Link>
                <form action={duplicatePortal.bind(null, p.id)}><button className={ghostButtonClass}>Duplicar</button></form>
                {!p.isDefault && (
                  <>
                    <form action={setDefaultPortal.bind(null, p.id)}><button className={ghostButtonClass}>Tornar padrão</button></form>
                    <form action={deletePortal.bind(null, p.id)}><button className={`${ghostButtonClass} text-red-600`}>Excluir</button></form>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
