import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, Table, ghostButtonClass, td } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatPhone } from "@/lib/phone";

const PAGE_SIZE = 100;

export default async function AccessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Number(params.page ?? 1));
  const where = { createdAt: { gte: filters.from, lte: filters.to }, locationId: filters.location, type: filters.type };
  const [locations, total, accesses] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" } }),
    db.access.count({ where }),
    db.access.findMany({
      where,
      include: { client: true, device: true, location: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));

  return (
    <>
      <PageHeader title="Acessos" subtitle={`${total} liberações no período`} />
      <FilterBar filters={filters} locations={locations} type />
      <Table head={["Data", "Local", "Cliente", "WhatsApp", "Tipo", "MAC", "IP", "Tempo liberado"]}>
        {accesses.map((a) => (
          <tr key={a.id}>
            <td className={td}>{a.createdAt.toLocaleString("pt-BR")}</td>
            <td className={td}>{a.location.name}</td>
            <td className={`${td} font-medium`}>{a.client.name}</td>
            <td className={td}>{formatPhone(a.client.phone)}</td>
            <td className={td}>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.type === "NEW" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {a.type === "NEW" ? "Novo" : "Recorrente"}
              </span>
            </td>
            <td className={`${td} font-mono text-xs`}>{a.device.mac}</td>
            <td className={`${td} font-mono text-xs`}>{a.ip}</td>
            <td className={td}>{a.grantedMinutes} min</td>
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
