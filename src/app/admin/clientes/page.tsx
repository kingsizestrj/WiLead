import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, Table, Td, ghostButtonClass, tr } from "@/components/admin/ui";
import { clientsInclude, clientsWhere } from "@/lib/clients-query";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatPhone } from "@/lib/phone";

const PAGE_SIZE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Number(params.page ?? 1));
  const where = clientsWhere(filters);
  const [locations, total, clients] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" } }),
    db.client.count({ where }),
    db.client.findMany({ where, include: clientsInclude, orderBy: { createdAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
  ]);
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${total} clientes acessaram no período`}
        actions={<a href={`/admin/clientes/export?${query}`} className={ghostButtonClass}>Exportar CSV</a>}
      />
      <FilterBar filters={filters} locations={locations} search />
      <Table head={["Nome", "WhatsApp", "E-mail", "Promoções", "Primeiro local", "Último acesso", "Acessos", "Aparelhos"]}>
        {clients.map((c) => (
          <tr key={c.id} className={tr}>
            <Td className="font-semibold max-md:text-base">{c.name}</Td>
            <Td label="WhatsApp">
              <a className="text-fuchsia-300 hover:underline" href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer">{formatPhone(c.phone)}</a>
            </Td>
            <Td label="E-mail">{c.email ?? "—"}</Td>
            <Td label="Promoções">{c.marketingOptIn ? "✅" : "—"}</Td>
            <Td label="Primeiro local">{c.firstLocation?.name ?? "—"}</Td>
            <Td label="Último acesso">
              {c.accesses[0] ? `${c.accesses[0].location.name} · ${c.accesses[0].createdAt.toLocaleString("pt-BR")}` : "—"}
            </Td>
            <Td label="Acessos">{c._count.accesses}</Td>
            <Td label="Aparelhos">{c._count.devices}</Td>
          </tr>
        ))}
        {!clients.length && (
          <tr className={tr}>
            <Td colSpan={8} className="text-ink-400">Nenhum cliente acessou no período.</Td>
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
