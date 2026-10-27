import { Prisma } from "@prisma/client";
import { Clapperboard, Clock, Eye, Funnel, MapPin, Megaphone, MousePointerClick, Repeat, Smartphone, TrendingUp, UserPlus, UserX, Wifi } from "lucide-react";
import { DailyChart, HourChart } from "@/components/admin/Charts";
import { FilterBar } from "@/components/admin/FilterBar";
import { Card, Empty, PageHeader, Stat } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatPhone } from "@/lib/phone";

const TZ = process.env.TZ_REPORTS ?? "America/Sao_Paulo";
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

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

  // Portal → code → internet, counted per device (MAC) that opened the portal in the period and location.
  const viewers = [
    ...new Set(
      (await db.portalEvent.findMany({ where: { ...where, type: "VIEW", mac: { not: null } }, distinct: ["mac"], select: { mac: true } })).map(
        (e) => e.mac!,
      ),
    ),
  ];
  const [codes, released] = await Promise.all([
    db.otpCode.findMany({ where: { createdAt: where.createdAt, mac: { in: viewers } }, orderBy: { createdAt: "desc" } }),
    db.access.findMany({ where: { ...where, device: { mac: { in: viewers } } }, distinct: ["deviceId"], select: { device: { select: { mac: true } } } }),
  ]);
  const requested = new Set(codes.map((c) => c.mac));
  const confirmed = new Set(codes.filter((c) => c.consumedAt).map((c) => c.mac));
  const confirmedPhones = new Set(codes.filter((c) => c.consumedAt).map((c) => c.phone));
  const releasedMacs = new Set(released.map((a) => a.device.mac));
  const funnel = [
    { label: "Abriram o portal", value: viewers.length },
    { label: "Pediram o código", value: requested.size },
    { label: "Confirmaram o código", value: confirmed.size },
    { label: "Internet liberada", value: [...confirmed].filter((mac) => releasedMacs.has(mac)).length },
  ];
  const withoutCode = [...releasedMacs].filter((mac) => !requested.has(mac)).length;
  // Phones that asked for a code and never got in, latest first (codes come newest first)
  const stuckByPhone = new Map<string, { name: string; phone: string; last: Date; codes: number; wrong: number }>();
  for (const c of codes) {
    if (confirmedPhones.has(c.phone) || releasedMacs.has(c.mac)) continue;
    const row = stuckByPhone.get(c.phone) ?? { name: c.name, phone: c.phone, last: c.createdAt, codes: 0, wrong: 0 };
    row.codes += 1;
    row.wrong += c.attempts;
    stuckByPhone.set(c.phone, row);
  }
  const stuck = [...stuckByPhone.values()];
  const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });

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

  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const maxLocation = perLocation[0]?._count ?? 0;
  const media = [
    { label: "Visualizações do portal", value: views, icon: Eye },
    { label: "Vídeos assistidos", value: eventCount("AD_VIDEO_COMPLETED"), icon: Clapperboard },
    { label: "Cliques em anúncios", value: eventCount("BLOCK_CLICK"), icon: MousePointerClick },
    { label: "Conversão (acesso/visita)", value: views ? `${Math.round((total / views) * 100)}%` : "—", icon: TrendingUp },
  ];

  return (
    <>
      <PageHeader
        title={
          <>
            {hello}, <span className="text-gradient">bem-vindo</span>
          </>
        }
        subtitle="De onde vêm e como se comportam os clientes do seu Wi-Fi"
      />
      <FilterBar filters={filters} locations={locations} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Acessos liberados" value={total.toLocaleString("pt-BR")} icon={<Wifi className="h-4 w-4" />} accent="bg-violet-500" />
        <Stat label="Novos clientes" value={newClients.toLocaleString("pt-BR")} hint={`${optIns} aceitaram receber promoções`} icon={<UserPlus className="h-4 w-4" />} accent="bg-fuchsia-500" />
        <Stat label="Aparelhos únicos" value={devices.toLocaleString("pt-BR")} icon={<Smartphone className="h-4 w-4" />} accent="bg-orange-500" />
        <Stat
          label="Taxa de retorno"
          value={total ? `${Math.round((returning / total) * 100)}%` : "—"}
          hint="acessos de quem já era cliente"
          icon={<Repeat className="h-4 w-4" />}
          accent="bg-sky-500"
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card title="Do portal à internet" icon={<Funnel className="h-4 w-4" />} className="xl:col-span-2">
          <ol className="flex flex-col gap-4">
            {funnel.map((step, i) => (
              <li key={step.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{step.label}</span>
                  <span>
                    <span className="font-bold">{step.value.toLocaleString("pt-BR")}</span>
                    {i > 0 && <span className="ml-2 text-xs text-ink-400">{pct(step.value, funnel[i - 1].value)} da etapa anterior</span>}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${viewers.length ? (step.value / viewers.length) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-400">
            Aparelhos no período. Fora desse caminho, {withoutCode.toLocaleString("pt-BR")}{" "}
            {withoutCode === 1 ? "cliente conhecido entrou" : "clientes conhecidos entraram"} com &quot;Sim, sou eu&quot;, sem código.
          </p>
        </Card>
        <Card title="Pediram o código e não entraram" icon={<UserX className="h-4 w-4" />}>
          {stuck.length ? (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {stuck.map((row) => (
                <li key={row.phone} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{row.name}</span>
                    <span className="shrink-0 text-xs text-ink-400">{when.format(row.last)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                    <a className="text-fuchsia-300 hover:underline" href={`https://wa.me/${row.phone}`} target="_blank" rel="noreferrer">{formatPhone(row.phone)}</a>
                    <span className="text-ink-400">
                      {row.codes} {row.codes === 1 ? "código" : "códigos"}
                      {row.wrong > 0 && ` · errou ${row.wrong}x`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-400">Ninguém travou no código no período.</p>
          )}
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card title="Acessos por dia e local" icon={<TrendingUp className="h-4 w-4" />} className="xl:col-span-2">
          {dailyData.length ? <DailyChart data={dailyData} series={series} /> : <Empty icon={<TrendingUp className="h-6 w-6" />} title="Sem acessos no período" />}
        </Card>
        <Card title="Ranking de locais" icon={<MapPin className="h-4 w-4" />}>
          <ol className="flex flex-col gap-4">
            {perLocation.map((row, i) => (
              <li key={row.locationId} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-bold text-ink-400">{i + 1}</span>
                    {locationName.get(row.locationId)}
                  </span>
                  <span className="font-bold">{row._count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(row._count / maxLocation) * 100}%` }} />
                </div>
              </li>
            ))}
            {!perLocation.length && <p className="text-sm text-ink-400">Sem acessos no período.</p>}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Horários de pico" icon={<Clock className="h-4 w-4" />} className="xl:col-span-2">
          <HourChart data={hourData} />
        </Card>
        <Card title="Mídia e anúncios" icon={<Megaphone className="h-4 w-4" />}>
          <ul className="flex flex-col gap-3">
            {media.map(({ label, value, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-fuchsia-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm text-ink-300">{label}</span>
                <span className="text-lg font-extrabold">{value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
