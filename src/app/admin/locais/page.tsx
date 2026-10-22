import { Card, PageHeader, buttonClass, inputClass } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { updateLocation } from "../actions";

export default async function LocationsPage() {
  const [locations, routers, portals, settings] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { accesses: true } } } }),
    db.router.findMany({ orderBy: { name: "asc" } }),
    db.portal.findMany({ orderBy: { name: "asc" } }),
    db.setting.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  return (
    <>
      <PageHeader
        title="Locais"
        subtitle="Cada servidor hotspot do MikroTik vira um local automaticamente no primeiro acesso. Dê um nome amigável e defina a landing page."
      />
      <div className="flex flex-col gap-4">
        {locations.map((l) => (
          <Card key={l.id}>
            <form action={updateLocation.bind(null, l.id)} className="grid items-end gap-3 md:grid-cols-6">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 md:col-span-2">
                Nome <span className="font-mono text-[10px] text-slate-400">servidor: {l.hotspotServer} · {l._count.accesses} acessos</span>
                {!l.routerId && <span className="text-xs font-semibold text-red-600">⚠ Sem roteador: os clientes deste local não conseguem conectar</span>}
                <input name="name" defaultValue={l.name} required className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Cidade / bairro
                <input name="city" defaultValue={l.city ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Tempo (min)
                <input name="sessionMinutes" type="number" min={1} defaultValue={l.sessionMinutes ?? ""} placeholder={`${settings.sessionMinutes} (padrão)`} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Roteador
                <select name="routerId" defaultValue={l.routerId ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {routers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Landing page
                <select name="portalId" defaultValue={l.portalId ?? ""} className={inputClass}>
                  <option value="">Padrão</option>
                  {portals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <button className={`${buttonClass} md:col-start-6`}>Salvar</button>
            </form>
          </Card>
        ))}
        {!locations.length && (
          <Card>
            <p className="text-sm text-slate-500">Nenhum local ainda. Assim que alguém abrir o portal por um hotspot, ele aparece aqui.</p>
          </Card>
        )}
      </div>
    </>
  );
}
