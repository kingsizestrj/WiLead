import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, Table, ghostButtonClass, td } from "@/components/admin/ui";
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
          <tr key={c.id}>
            <td className={`${td} font-medium`}>{c.name}</td>
            <td className={td}>
              <a className="text-fuchsia-300 hover:underline" href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer">{formatPhone(c.phone)}</a>
            </td>
            <td className={td}>{c.email ?? "—"}</td>
            <td className={td}>{c.marketingOptIn ? "✅" : "—"}</td>
            <td className={td}>{c.firstLocation?.name ?? "—"}</td>
            <td className={td}>
              {c.accesses[0] ? `${c.accesses[0].location.name} · ${c.accesses[0].createdAt.toLocaleString("pt-BR")}` : "—"}
            </td>
            <td className={td}>{c._count.accesses}</td>
            <td className={td}>{c._count.devices}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 flex justify-end gap-2">
        {page > 1 && <Link className={ghostButtonClass} href={`?${query}&page=${page - 1}`}>Anterior</Link>}
        {page * PAGE_SIZE < total && <Link className={ghostButtonClass} href={`?${query}&page=${page + 1}`}>Próxima</Link>}
      </div>
    </>
  );
}
