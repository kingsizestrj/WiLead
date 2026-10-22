import { Prisma } from "@prisma/client";
import { DailyChart, HourChart } from "@/components/admin/Charts";
import { FilterBar } from "@/components/admin/FilterBar";
import { Card, PageHeader, Stat, Table, td } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";

const TZ = process.env.TZ_REPORTS ?? "America/Sao_Paulo";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const locations = await db.location.findMany({ orderBy: { name: "asc" } });
  const where = { createdAt: { gte: filters.from, lte: filters.to }, locationId: filters.location };
  const locationSql = filters.location ? Prisma.sql`AND "locationId" = ${filters.location}` : Prisma.empty;

  const [total, byType, devices, newClients, optIns, perLocation, daily, hourly, events] = await Promise.all([
    db.access.count({ where }),
    db.access.groupBy({ by: ["type"], where, _count: true }),
    db.access.groupBy({ by: ["deviceId"], where }).then((r) => r.length),
    db.client.count({ where: { createdAt: where.createdAt, firstLocationId: filters.location } }),
    db.client.count({ where: { createdAt: where.createdAt, firstLocationId: filters.location, marketingOptIn: true } }),
    db.access.groupBy({ by: ["locationId"], where, _count: true, orderBy: { _count: { locationId: "desc" } } }),
    db.$queryRaw<{ day: string; locationId: string; count: bigint }[]>`
      SELECT to_char(d, 'DD/MM') AS day, "locationId", count(*) AS count
      FROM (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}) AS d, "locationId"
        FROM "Access" WHERE "createdAt" BETWEEN ${filters.from} AND ${filters.to} ${locationSql}
      ) t
      GROUP BY d, "locationId" ORDER BY d`,
    db.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT extract(hour FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS hour, count(*) AS count
      FROM "Access" WHERE "createdAt" BETWEEN ${filters.from} AND ${filters.to} ${locationSql}
      GROUP BY 1`,
    db.portalEvent.groupBy({ by: ["type"], where, _count: true }),
  ]);

  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const series = [...new Set(daily.map((d) => locationName.get(d.locationId) ?? "?"))];
  const dailyData = Object.values(
    daily.reduce<Record<string, Record<string, string | number>>>((acc, row) => {
      acc[row.day] ??= { day: row.day };
      acc[row.day][locationName.get(row.locationId) ?? "?"] = Number(row.count);
      return acc;
    }, {}),
  );
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    acessos: Number(hourly.find((r) => r.hour === h)?.count ?? 0),
  }));
  const returning = byType.find((t) => t.type === "RETURNING")?._count ?? 0;
  const eventCount = (type: string) => events.find((e) => e.type === type)?._count ?? 0;
  const views = eventCount("VIEW");

  return (
    <>
      <PageHeader title="Dashboard" subtitle="De onde vêm e como se comportam seus clientes" />
      <FilterBar filters={filters} locations={locations} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Acessos liberados" value={total} />
        <Stat label="Novos clientes" value={newClients} hint={`${optIns} aceitaram receber promoções`} />
        <Stat label="Dispositivos únicos" value={devices} />
        <Stat label="Taxa de retorno" value={total ? `${Math.round((returning / total) * 100)}%` : "—"} hint="acessos de quem já era cliente" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Acessos por dia e local" className="lg:col-span-2">
          <DailyChart data={dailyData} series={series} />
        </Card>
        <Card title="Ranking de locais">
          <ol className="flex flex-col gap-3">
            {perLocation.map((row, i) => (
              <li key={row.locationId} className="flex items-center justify-between text-sm">
                <span><span className="mr-2 text-slate-400">{i + 1}.</span>{locationName.get(row.locationId)}</span>
                <span className="font-semibold">{row._count}</span>
              </li>
            ))}
            {!perLocation.length && <p className="text-sm text-slate-400">Sem acessos no período.</p>}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Horários de pico" className="lg:col-span-2">
          <HourChart data={hourData} />
        </Card>
        <Card title="Mídia / anúncios">
          <Table head={["Métrica", "Total"]}>
            <tr><td className={td}>Visualizações do portal</td><td className={td}>{views}</td></tr>
            <tr><td className={td}>Vídeos assistidos</td><td className={td}>{eventCount("AD_VIDEO_COMPLETED")}</td></tr>
            <tr><td className={td}>Cliques em anúncios</td><td className={td}>{eventCount("BLOCK_CLICK")}</td></tr>
            <tr><td className={td}>Conversão (acesso/visita)</td><td className={td}>{views ? `${Math.round((total / views) * 100)}%` : "—"}</td></tr>
          </Table>
        </Card>
      </div>
    </>
  );
}
