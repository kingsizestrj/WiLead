import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Badge, PageHeader, Table, Td, ghostButtonClass, tr } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatPhone } from "@/lib/phone";

const PAGE_SIZE = 100;
const TZ = process.env.TZ ?? "America/Sao_Paulo";

export default async function AccessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Number(params.page ?? 1));
  const where = { createdAt: { gte: filters.from, lte: filters.to }, locationId: filters.location, type: filters.type };
  const [locations, total, accesses, failures] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" } }),
    db.access.count({ where }),
    db.access.findMany({
      where,
      include: { client: true, device: true, location: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.accessFailure.findMany({
      where: { createdAt: where.createdAt, locationId: filters.location },
      include: { location: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));

  return (
    <>
      <PageHeader title="Acessos" subtitle={`${total} liberações no período`} />
      <FilterBar filters={filters} locations={locations} type />
      {failures.length > 0 && (
        <section className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h2 className="mb-2 text-sm font-semibold text-rose-200">Falhas ao liberar no período (últimas {failures.length})</h2>
          <ul className="flex flex-col gap-1 text-sm text-rose-200">
            {failures.map((f) => (
              <li key={f.id}>
                {f.createdAt.toLocaleString("pt-BR", { timeZone: TZ })} · {f.location.name} · {f.clientName} ({f.mac}): <b>{f.error}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Table head={["Data", "Local", "Cliente", "WhatsApp", "Tipo", "MAC", "IP", "Tempo liberado"]}>
        {accesses.map((a) => (
          <tr key={a.id} className={tr}>
            <Td label="Data">{a.createdAt.toLocaleString("pt-BR")}</Td>
            <Td label="Local">{a.location.name}</Td>
            <Td label="Cliente" className="font-semibold">{a.client.name}</Td>
            <Td label="WhatsApp">{formatPhone(a.client.phone)}</Td>
            <Td label="Tipo">
              <Badge tone={a.type === "NEW" ? "green" : "sky"}>{a.type === "NEW" ? "Novo" : "Recorrente"}</Badge>
            </Td>
            <Td label="MAC" className="font-mono text-xs">{a.device.mac}</Td>
            <Td label="IP" className="font-mono text-xs">{a.ip}</Td>
            <Td label="Tempo liberado">{a.grantedMinutes} min</Td>
          </tr>
        ))}
        {!accesses.length && (
          <tr className={tr}>
            <Td colSpan={8} className="text-ink-400">Nenhuma liberação no período.</Td>
          </tr>
        )}
      </Table>
      <div className="mt-4 flex justify-end gap-2">
        {page > 1 && <Link className={ghostButtonClass} href={`?${query}&page=${page - 1}`}>Anterior</Link>}
        {page * PAGE_SIZE < total && <Link className={ghostButtonClass} href={`?${query}&page=${page + 1}`}>Próxima</Link>}
      </div>
    </>
  );
}
