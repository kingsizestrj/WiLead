import { Funnel, MapPin, Settings2 } from "lucide-react";
import { FilterBar } from "@/components/admin/FilterBar";
import { Card, PageHeader, Table, Td, tr } from "@/components/admin/ui";
import { BLOCK_LABELS, type Block } from "@/lib/blocks";
import { accountLabels } from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { computeFunnel } from "@/lib/funnel";
import { FunnelEditor } from "./FunnelEditor";

const CLICKABLE: Block["type"][] = ["banner", "whatsapp", "instagram"];

function blockDetail(block: Block) {
  if (block.type === "whatsapp") return block.label;
  if (block.type === "banner") return block.caption || block.linkUrl;
  if (block.type === "instagram") return `@${block.handle.replace("@", "")}`;
  return "";
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

export default async function FunnelPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [steps, portals, locations, labels] = await Promise.all([
    db.funnelStep.findMany({ orderBy: { position: "asc" } }),
    db.portal.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { name: "asc" } }),
    accountLabels().catch(() => [] as string[]),
  ]);
  const funnel = await computeFunnel(filters, steps);
  const base = funnel.stages[0].total;
  const blocks = portals.flatMap((p) =>
    (p.blocks as Block[])
      .filter((b) => CLICKABLE.includes(b.type))
      .map((b) => ({ id: b.id, label: `${p.name} · ${BLOCK_LABELS[b.type]}: ${blockDetail(b)}` })),
  );

  return (
    <>
      <PageHeader title="Funil de vendas" subtitle="Do Wi-Fi até a venda: quantos clientes passam por cada etapa, no total e por local." />
      <FilterBar filters={filters} locations={locations} />

      {funnel.error && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{funnel.error}</p>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Funil" icon={<Funnel className="h-4 w-4" />}>
          <ol className="flex flex-col gap-3">
            {funnel.stages.map((stage, i) => (
              <li key={stage.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="mr-2 font-bold text-ink-400">{i + 1}</span>
                    {stage.name}
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="text-lg">{stage.total.toLocaleString("pt-BR")}</b>
                    {i > 0 && <span className="ml-2 text-xs text-ink-400">{pct(stage.total, funnel.stages[i - 1].total)} da etapa anterior</span>}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: base ? `${Math.max(2, (stage.total / base) * 100)}%` : "0%" }} />
                </div>
              </li>
            ))}
          </ol>
          {funnel.stages.length > 1 && (
            <p className="mt-5 text-sm text-ink-300">
              Conversão total: <b className="text-white">{pct(funnel.stages[funnel.stages.length - 1].total, base)}</b> de quem conectou chegou em
              &quot;{funnel.stages[funnel.stages.length - 1].name}&quot;.
            </p>
          )}
        </Card>

        <Card title="Como funciona" icon={<Settings2 className="h-4 w-4" />}>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-ink-300">
            <li>Cada etapa conta só quem passou pelas anteriores.</li>
            <li>
              <b className="text-white">Etiqueta no Chatwoot</b> vale para etiquetas no contato ou em qualquer conversa dele, colocadas pela equipe, pela IA ou pelo
              WiLead.
            </li>
            <li>
              Botões de WhatsApp e banners podem dar uma etiqueta ao clicar (ex.: <code>lead-verao</code>) em Landing pages. Quem clica antes de se cadastrar
              recebe a etiqueta quando conclui o cadastro.
            </li>
            <li>As etiquetas do Chatwoot são lidas a cada 5 minutos.</li>
          </ul>
        </Card>
      </div>

      {funnel.byLocation.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <MapPin className="h-4 w-4 text-fuchsia-300" /> Por local
          </h2>
          <Table head={["Local", ...funnel.stages.map((s) => s.name)]}>
            {funnel.byLocation.map((l) => (
              <tr key={l.id} className={tr}>
                <Td className="font-semibold max-md:text-base">{l.name}</Td>
                {l.counts.map((count, i) => (
                  <Td key={funnel.stages[i].id} label={funnel.stages[i].name}>
                    {count}
                    {i > 0 && <span className="ml-1.5 text-xs text-ink-400">{pct(count, l.counts[0])}</span>}
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        </div>
      )}

      <Card title="Configurar etapas" icon={<Settings2 className="h-4 w-4" />}>
        <FunnelEditor initial={steps.map((s) => ({ name: s.name, type: s.type, param: s.param }))} blocks={blocks} labels={labels} />
      </Card>
    </>
  );
}
