import type { AccessPoint, IncidentKind, Location, LocationSource, Router } from "@prisma/client";
import type { RouterOSAPI } from "node-routeros";
import { db, getSettings } from "./db";
import { withRouter } from "./mikrotik";
import { unifiDevices, type UnifiDevice } from "./unifi";

// Point health: every few minutes WiLead asks each MikroTik about its hotspots and pings the
// access points through it (works for any AP brand); UniFi APs also come from the controller.
// Incidents are opened and closed automatically and only shown in the panel.

const INTERVAL_MS = 5 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const AP_DOWN_AFTER = 2; // consecutive failed checks before opening an incident
const SILENT_SAMPLES = 3; // 15 minutes with nobody...
const SILENT_USUAL_HOSTS = 3; // ...at an hour that usually has at least this many devices
const PING_CONCURRENCY = 8;
const TZ = process.env.TZ ?? "America/Sao_Paulo";

type Row = Record<string, string>;
type PointLocation = Location & { sources: LocationSource[]; accessPoints: AccessPoint[] };

export const healthState: { lastRunAt: Date | null; unifiError: string | null } = { lastRunAt: null, unifiError: null };

// RouterOS durations: "850us", "1ms", "12ms345us", "1s2ms"
function durationMs(value: string | undefined) {
  if (!value) return null;
  const units: Record<string, number> = { s: 1000, ms: 1, us: 0.001 };
  return [...value.matchAll(/(\d+)(ms|us|s)/g)].reduce((ms, [, n, unit]) => ms + Number(n) * units[unit], 0);
}

async function ping(api: RouterOSAPI, ip: string) {
  const replies = (await api.write("/ping", [`=address=${ip}`, "=count=3"])) as Row[];
  const last = replies[replies.length - 1];
  const received = Number(last?.received ?? 0);
  return { up: received > 0, latencyMs: received ? durationMs(last["avg-rtt"]) : null };
}

async function setIncident(kind: IncidentKind, locationId: string, apId: string | null, active: boolean, detail: string) {
  const open = await db.incident.findFirst({ where: { kind, locationId, apId, endedAt: null } });
  if (active && !open) await db.incident.create({ data: { kind, locationId, apId, detail } });
  if (!active && open) await db.incident.update({ where: { id: open.id }, data: { endedAt: new Date() } });
}

const hourOf = (date: Date) => Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(date));

// "Ponto mudo": nobody on the point for 15 minutes at an hour that usually has people.
async function isSilent(locationId: string) {
  const recent = await db.healthSample.findMany({ where: { locationId }, orderBy: { at: "desc" }, take: SILENT_SAMPLES });
  if (recent.length < SILENT_SAMPLES || recent.some((s) => s.hotspotUp !== true || (s.hosts ?? 0) > 0)) return false;
  const hour = hourOf(new Date());
  const startOfToday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await db.healthSample.findMany({
    where: { locationId, at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), lt: startOfToday }, hosts: { not: null } },
    select: { at: true, hosts: true },
  });
  const sameHour = history.filter((s) => hourOf(s.at) === hour);
  if (!sameHour.length) return false;
  return sameHour.reduce((sum, s) => sum + (s.hosts ?? 0), 0) / sameHour.length >= SILENT_USUAL_HOSTS;
}

async function collectRouter(router: Router, locations: PointLocation[], unifi: Map<string, UnifiDevice> | null) {
  let reachable = true;
  try {
    await withRouter(router, async (api) => {
      const [servers, hosts, active, dhcp, leases, interfaces] = (await Promise.all([
        api.write("/ip/hotspot/print"),
        api.write("/ip/hotspot/host/print"),
        api.write("/ip/hotspot/active/print"),
        api.write("/ip/dhcp-server/print"),
        api.write("/ip/dhcp-server/lease/print"),
        api.write("/interface/print"),
      ])) as Row[][];

      for (const location of locations) {
        const names = new Set(location.sources.map((s) => s.hotspotServer));
        const locationServers = servers.filter((s) => names.has(s.name));
        const ifaceNames = new Set(locationServers.map((s) => s.interface));
        const dhcpNames = new Set(dhcp.filter((d) => ifaceNames.has(d.interface)).map((d) => d.name));
        const ifaces = interfaces.filter((i) => ifaceNames.has(i.name));
        const hotspotUp = locationServers.length ? locationServers.every((s) => s.disabled !== "true" && s.invalid !== "true") : null;

        await db.healthSample.create({
          data: {
            locationId: location.id,
            hotspotUp,
            hosts: hosts.filter((h) => names.has(h.server)).length,
            active: active.filter((a) => names.has(a.server)).length,
            leases: leases.filter((l) => dhcpNames.has(l.server)).length,
            rxBytes: ifaces.length ? ifaces.reduce((sum, i) => sum + BigInt(i["rx-byte"] ?? 0), BigInt(0)) : null,
            txBytes: ifaces.length ? ifaces.reduce((sum, i) => sum + BigInt(i["tx-byte"] ?? 0), BigInt(0)) : null,
          },
        });
        await setIncident(
          "HOTSPOT_DOWN",
          location.id,
          null,
          hotspotUp === false || (location.sources.length > 0 && hotspotUp === null),
          locationServers.length ? "servidor hotspot desativado ou inválido no MikroTik" : "servidor hotspot não existe mais no MikroTik",
        );
        await setIncident("POINT_SILENT", location.id, null, await isSilent(location.id), "nenhum aparelho no ponto num horário que costuma ter movimento");

        const aps = location.accessPoints;
        for (let i = 0; i < aps.length; i += PING_CONCURRENCY) {
          await Promise.all(
            aps.slice(i, i + PING_CONCURRENCY).map(async (ap) => {
              const result = await ping(api, ap.ip);
              const controller = ap.vendor === "UNIFI" ? unifi?.get(ap.ip) : undefined;
              await db.apSample.create({
                data: {
                  apId: ap.id,
                  up: result.up || !!controller?.online,
                  latencyMs: result.latencyMs,
                  clients: controller?.clients,
                  uptimeSec: controller?.uptimeSec,
                  firmware: controller?.firmware,
                },
              });
              const last = await db.apSample.findMany({ where: { apId: ap.id }, orderBy: { at: "desc" }, take: AP_DOWN_AFTER });
              await setIncident("AP_DOWN", location.id, ap.id, last.length === AP_DOWN_AFTER && last.every((s) => !s.up), `${ap.name} (${ap.ip}) sem resposta`);
            }),
          );
        }
      }
    });
  } catch (error) {
    reachable = false;
    console.error(`[saude] ${router.name}:`, (error as Error).message);
    for (const location of locations) await db.healthSample.create({ data: { locationId: location.id } });
  }
  for (const location of locations) {
    await setIncident("ROUTER_UNREACHABLE", location.id, null, !reachable, `o WiLead não conseguiu falar com o roteador ${router.name}`);
  }
}

let running: Promise<void> | null = null;

export function collectHealth() {
  running ??= (async () => {
    const settings = await getSettings();
    let unifi: Map<string, UnifiDevice> | null = null;
    if (settings.unifiUrl && settings.unifiUser && settings.unifiPassword) {
      try {
        const devices = await unifiDevices({ url: settings.unifiUrl, user: settings.unifiUser, password: settings.unifiPassword, site: settings.unifiSite });
        unifi = new Map(devices.map((d) => [d.ip, d]));
        healthState.unifiError = null;
      } catch (error) {
        healthState.unifiError = (error as Error).message;
      }
    }

    const routers = await db.router.findMany({ include: { locations: { include: { sources: true, accessPoints: true } } } });
    for (const router of routers) if (router.locations.length) await collectRouter(router, router.locations, unifi);

    const old = new Date(Date.now() - RETENTION_MS);
    await db.healthSample.deleteMany({ where: { at: { lt: old } } });
    await db.apSample.deleteMany({ where: { at: { lt: old } } });
    await db.incident.deleteMany({ where: { endedAt: { lt: old } } });
    healthState.lastRunAt = new Date();
  })().finally(() => {
    running = null;
  });
  return running;
}

let started = false;

export function startHealthMonitor() {
  if (started || process.env.HOTSPOT_DRY_RUN === "true") return;
  started = true;
  const run = () => collectHealth().catch((error) => console.error("[saude]", error));
  setTimeout(run, 30_000);
  setInterval(run, INTERVAL_MS);
}
