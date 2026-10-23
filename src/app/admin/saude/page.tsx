import type { HealthSample, Incident } from "@prisma/client";
import { AlertTriangle, CheckCircle2, HeartPulse, Link2, Radio, Router as RouterIcon, Wifi } from "lucide-react";
import { Badge, Card, Empty, PageHeader, Stat, buttonClass, inputClass } from "@/components/admin/ui";
import { db, getSettings } from "@/lib/db";
import { healthState } from "@/lib/health";
import { unifiDevices, type UnifiDevice } from "@/lib/unifi";
import { linkUnifiAp } from "../actions";
import { CollectButton } from "./CollectButton";

const DAY = 24 * 60 * 60 * 1000;
const KIND_LABEL: Record<Incident["kind"], string> = {
  ROUTER_UNREACHABLE: "Roteador inacessível",
  HOTSPOT_DOWN: "Hotspot fora do ar",
  AP_DOWN: "AP sem resposta",
  POINT_SILENT: "Ponto mudo",
};
const VENDOR_LABEL = { UNIFI: "UniFi", INTELBRAS: "Intelbras", GREATEK: "Greatek", OTHER: "Outro" };

const time = (d: Date) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function trafficMbps(samples: HealthSample[]) {
  const [last, prev] = samples.filter((s) => s.rxBytes !== null && s.txBytes !== null);
  if (!last || !prev) return null;
  const seconds = (last.at.getTime() - prev.at.getTime()) / 1000;
  const rate = (a: bigint, b: bigint) => Math.max(0, Number(a - b) * 8) / seconds / 1e6;
  return { rx: rate(last.rxBytes!, prev.rxBytes!), tx: rate(last.txBytes!, prev.txBytes!) };
}

// Highest number of devices per hour over the last 24h (oldest first).
function hourlyHosts(samples: HealthSample[]) {
  const buckets = Array.from({ length: 24 }, () => 0);
  const now = Date.now();
  for (const s of samples) {
    const hoursAgo = Math.floor((now - s.at.getTime()) / 3_600_000);
    if (hoursAgo < 24) buckets[23 - hoursAgo] = Math.max(buckets[23 - hoursAgo], s.hosts ?? 0);
  }
  return buckets;
}

export default async function HealthPage() {
  const since = new Date(Date.now() - DAY);
  const [locations, samples, apSamples, incidents, settings] = await Promise.all([
    db.location.findMany({ where: { routerId: { not: null } }, orderBy: { name: "asc" }, include: { accessPoints: { orderBy: { name: "asc" } }, router: true } }),
    db.healthSample.findMany({ where: { at: { gte: since } }, orderBy: { at: "desc" } }),
    db.apSample.findMany({ where: { at: { gte: since } }, orderBy: { at: "desc" } }),
    db.incident.findMany({ where: { OR: [{ endedAt: null }, { endedAt: { gte: since } }] }, orderBy: { startedAt: "desc" }, include: { location: true, ap: true } }),
    getSettings(),
  ]);

  let controllerAps: UnifiDevice[] = [];
  let unifiError = healthState.unifiError;
  if (settings.unifiUrl && settings.unifiUser && settings.unifiPassword) {
    try {
      controllerAps = await unifiDevices({ url: settings.unifiUrl, user: settings.unifiUser, password: settings.unifiPassword, site: settings.unifiSite });
    } catch (error) {
      unifiError = (error as Error).message;
    }
  }
  const linkedIps = new Set(locations.flatMap((l) => l.accessPoints.map((a) => a.ip)));
  const unlinked = controllerAps.filter((d) => !linkedIps.has(d.ip));

  const open = incidents.filter((i) => !i.endedAt);
  const allAps = locations.flatMap((l) => l.accessPoints);
  const apLast = new Map(allAps.map((ap) => [ap.id, apSamples.find((s) => s.apId === ap.id)]));
  const apsUp = allAps.filter((ap) => apLast.get(ap.id)?.up).length;
  const pointsOk = locations.filter((l) => !open.some((i) => i.locationId === l.id)).length;
  const lastRun = samples[0]?.at ?? null;

  return (
    <>
      <PageHeader
        title="Saúde dos pontos"
        subtitle={`Verificação automática a cada 5 minutos pelo MikroTik${settings.unifiUrl ? " e pela controladora UniFi" : ""}. Última: ${lastRun ? time(lastRun) : "ainda não rodou"}.`}
        actions={<CollectButton />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Pontos sem problema" value={`${pointsOk}/${locations.length}`} icon={<CheckCircle2 className="h-4 w-4" />} accent="bg-emerald-500" />
        <Stat label="APs online" value={`${apsUp}/${allAps.length}`} icon={<Radio className="h-4 w-4" />} accent="bg-sky-500" />
        <Stat label="Incidentes abertos" value={open.length} icon={<AlertTriangle className="h-4 w-4" />} accent={open.length ? "bg-rose-500" : "bg-violet-500"} />
        <Stat label="Resolvidos em 24h" value={incidents.length - open.length} icon={<HeartPulse className="h-4 w-4" />} accent="bg-fuchsia-500" />
      </div>

      {open.length > 0 && (
        <section className="mb-6 animate-fade-up rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-rose-200">
            <AlertTriangle className="h-4 w-4" /> Incidentes abertos
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={i.kind === "POINT_SILENT" ? "amber" : "rose"}>{KIND_LABEL[i.kind]}</Badge>
                <b>{i.location.name}</b>
                <span className="text-ink-300">{i.detail}</span>
                <span className="text-xs text-ink-400">desde {time(i.startedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!locations.length ? (
        <Empty icon={<HeartPulse className="h-6 w-6" />} title="Nenhum ponto monitorado" text="Vincule os locais a um roteador e cadastre os APs em Locais." />
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {locations.map((l) => {
            const ls = samples.filter((s) => s.locationId === l.id);
            const last = ls[0];
            const issues = open.filter((i) => i.locationId === l.id);
            const tone = !last ? "zinc" : issues.some((i) => i.kind !== "POINT_SILENT") ? "rose" : issues.length ? "amber" : "green";
            const traffic = trafficMbps(ls);
            const hours = hourlyHosts(ls);
            const peak = Math.max(1, ...hours);
            const reachable = ls.filter((s) => s.hotspotUp !== null).length;
            return (
              <Card key={l.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{l.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-ink-400">
                      <RouterIcon className="h-3.5 w-3.5" /> {l.router?.name} {l.city && `· ${l.city}`}
                    </p>
                  </div>
                  <Badge tone={tone}>{!last ? "Sem dados ainda" : tone === "green" ? "OK" : tone === "amber" ? "Atenção" : "Problema"}</Badge>
                </div>

                {last && (
                  <dl className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                    {[
                      ["Hotspot", last.hotspotUp === null ? "—" : last.hotspotUp ? "Ativo" : "Fora"],
                      ["Aparelhos", last.hosts ?? "—"],
                      ["Conectados", last.active ?? "—"],
                      ["IPs DHCP", last.leases ?? "—"],
                      ["Tráfego", traffic ? `${traffic.tx.toFixed(1)}↓ ${traffic.rx.toFixed(1)}↑` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] p-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
                        <dd className="mt-1 text-sm font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mb-1 flex items-center justify-between text-xs text-ink-400">
                  <span>Aparelhos nas últimas 24h</span>
                  <span>Roteador respondeu em {pct(reachable, ls.length)} das verificações</span>
                </div>
                <div className="mb-4 flex h-12 items-end gap-0.5">
                  {hours.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-brand opacity-80" style={{ height: `${Math.max(4, (h / peak) * 100)}%` }} title={`${h} aparelhos`} />
                  ))}
                </div>

                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
                  <Wifi className="h-3.5 w-3.5" /> Access points
                </h4>
                {l.accessPoints.length ? (
                  <ul className="flex flex-col divide-y divide-white/5">
                    {l.accessPoints.map((ap) => {
                      const s = apLast.get(ap.id);
                      const apSamplesOf = apSamples.filter((x) => x.apId === ap.id);
                      return (
                        <li key={ap.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                          <span className={`h-2 w-2 rounded-full ${!s ? "bg-ink-400" : s.up ? "bg-emerald-400" : "bg-rose-500"}`} />
                          <span className="font-semibold">{ap.name}</span>
                          <span className="font-mono text-xs text-ink-400">{ap.ip}</span>
                          <Badge tone="zinc">{VENDOR_LABEL[ap.vendor]}</Badge>
                          <span className="ms-auto text-xs text-ink-300">
                            {s?.latencyMs != null && `${s.latencyMs.toFixed(0)} ms · `}
                            {s?.clients != null && `${s.clients} clientes · `}
                            {pct(apSamplesOf.filter((x) => x.up).length, apSamplesOf.length)} online em 24h
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-400">Nenhum AP cadastrado. Cadastre em Locais para monitorar o ping.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {settings.unifiUrl && (
        <Card title="Controladora UniFi" icon={<Link2 className="h-4 w-4" />}>
          {unifiError ? (
            <p className="text-sm text-rose-300">Não foi possível falar com a controladora: {unifiError}</p>
          ) : unlinked.length ? (
            <>
              <p className="mb-3 text-sm text-ink-300">APs da controladora que ainda não estão em nenhum ponto. Escolha o ponto de cada um:</p>
              <ul className="flex flex-col gap-2">
                {unlinked.map((d) => (
                  <li key={d.mac}>
                    <form action={linkUnifiAp} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="hidden" name="ip" value={d.ip} />
                      <input type="hidden" name="name" value={d.name} />
                      <span className={`h-2 w-2 rounded-full ${d.online ? "bg-emerald-400" : "bg-rose-500"}`} />
                      <span className="font-semibold">{d.name}</span>
                      <span className="font-mono text-xs text-ink-400">{d.ip} · {d.model}</span>
                      <select name="locationId" required defaultValue="" className={`${inputClass} !w-auto !py-1.5 sm:ms-auto`}>
                        <option value="" disabled>Ponto…</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <button className={`${buttonClass} !px-3 !py-1.5`}>Vincular</button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-300">Todos os {controllerAps.length} APs da controladora estão vinculados a um ponto.</p>
          )}
        </Card>
      )}
    </>
  );
}
