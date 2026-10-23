import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Card, PageHeader, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { createLocation, deleteLocation, mergeLocation, moveLocationSource, removePointAction, updateLocation } from "../actions";

const DAY = 24 * 60 * 60 * 1000;
const accessesText = (n: number) => (n === 1 ? "O 1 acesso" : `Os ${n} acessos`);

export default async function LocationsPage() {
  const since = new Date(Date.now() - DAY);
  const [locations, routers, portals, settings] = await Promise.all([
    db.location.findMany({
      orderBy: { name: "asc" },
      include: {
        sources: { orderBy: { createdAt: "asc" } },
        _count: { select: { accesses: true, failures: { where: { createdAt: { gte: since } } } } },
      },
    }),
    db.router.findMany({ orderBy: { name: "asc" } }),
    db.portal.findMany({ orderBy: { name: "asc" } }),
    db.setting.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  return (
    <>
      <PageHeader
        title="Locais"
        subtitle="Cada ponto onde os clientes se conectam. O ponto é identificado pelo servidor hotspot e pela porta/VLAN de onde o cliente veio."
      />

      <Card title="Novo local" className="mb-4">
        <form action={createLocation} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
            Nome
            <input name="name" required placeholder="Praça Central" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
            Cidade / bairro
            <input name="city" placeholder="Grussaí" className={inputClass} />
          </label>
          <button className={buttonClass}>Criar local</button>
        </form>
        <p className="mt-3 text-xs text-ink-400">
          Locais também são criados sozinhos quando um cliente chega por uma origem nova. Para juntar pontos, use &quot;Mover para&quot;: ao mover a última origem de um local, o histórico vai junto e o local vazio some.
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        {locations.map((l) => (
          <Card key={l.id}>
            <form action={updateLocation.bind(null, l.id)} className="grid items-end gap-3 md:grid-cols-6">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300 md:col-span-2">
                Nome <span className="text-[10px] text-ink-400">{l._count.accesses} acessos</span>
                <input name="name" defaultValue={l.name} required className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Cidade / bairro
                <input name="city" defaultValue={l.city ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Tempo (min)
                <input name="sessionMinutes" type="number" min={1} defaultValue={l.sessionMinutes ?? ""} placeholder={`${settings.sessionMinutes} (padrão)`} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Roteador
                <select name="routerId" defaultValue={l.routerId ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {routers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Landing page
                <select name="portalId" defaultValue={l.portalId ?? ""} className={inputClass}>
                  <option value="">Padrão</option>
                  {portals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <button className={`${buttonClass} md:col-start-6`}>Salvar</button>
            </form>

            {!l.routerId && <p className="mt-3 text-xs font-semibold text-rose-300">⚠ Sem roteador: os clientes deste local não conseguem conectar.</p>}
            {l._count.failures > 0 && (
              <p className="mt-3 text-xs font-semibold text-rose-300">⚠ {l._count.failures} falha(s) ao liberar nas últimas 24h. Veja o motivo em Acessos.</p>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Origens</span>
              {l.sources.map((s) => (
                <form key={s.id} action={moveLocationSource.bind(null, s.id)} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-xs">
                    {s.hotspotServer}
                    {s.interfaceName ? ` · ${s.interfaceName}` : ""}
                  </span>
                  {locations.length > 1 && (
                    <>
                      <select name="locationId" defaultValue={l.id} className={`${inputClass} !py-1 text-xs`}>
                        {locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <button className={`${ghostButtonClass} !px-2 !py-1 text-xs`}>Mover para</button>
                    </>
                  )}
                </form>
              ))}
              {!l.sources.length && <p className="text-xs text-ink-400">Nenhuma origem. Mova para cá uma origem de outro local.</p>}
            </div>

            {l.mikrotikSlug && l.routerId && (
              <form action={removePointAction.bind(null, l.id)} className="mt-3">
                <ConfirmButton
                  message={`Remover do MikroTik o hotspot, o DHCP, a rede e a VLAN do ponto ${l.name}? O histórico continua no WiLead.`}
                  className={`${ghostButtonClass} !px-2 !py-1 text-xs text-rose-300`}
                >
                  Remover ponto do MikroTik
                </ConfirmButton>
              </form>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              {locations.length > 1 && (
                <form action={mergeLocation.bind(null, l.id)} className="flex flex-wrap items-center gap-2">
                  <select name="targetId" required defaultValue="" className={`${inputClass} !w-auto !py-1 text-xs`}>
                    <option value="" disabled>Juntar com…</option>
                    {locations.filter((o) => o.id !== l.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ConfirmButton
                    message={`Juntar "${l.name}" ao local escolhido? ${l._count.accesses ? `${accessesText(l._count.accesses)} e as origens vão junto` : "As origens vão junto"}, e "${l.name}" deixa de existir.`}
                    className={`${ghostButtonClass} !px-2 !py-1 text-xs`}
                  >
                    Juntar
                  </ConfirmButton>
                </form>
              )}
              <form action={deleteLocation.bind(null, l.id)} className="ms-auto">
                <ConfirmButton
                  message={`Excluir "${l.name}" do WiLead?${l._count.accesses ? ` ${accessesText(l._count.accesses)} deste local também ${l._count.accesses === 1 ? "será apagado" : "serão apagados"} (para manter o histórico, use "Juntar").` : ""} Nada é alterado no MikroTik.`}
                  className={`${ghostButtonClass} !px-2 !py-1 text-xs text-rose-300`}
                >
                  Excluir local
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ))}
        {!locations.length && (
          <Card>
            <p className="text-sm text-ink-300">Nenhum local ainda. Assim que alguém abrir o portal por um hotspot, ele aparece aqui.</p>
          </Card>
        )}
      </div>
    </>
  );
}
