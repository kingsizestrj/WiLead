import type { FunnelStep } from "@prisma/client";
import { phonesWithLabel } from "./chatwoot";
import { db } from "./db";
import type { Filters } from "./filters";

// Funnel: clients that connected in the period (base), narrowed stage by stage.
// Each stage keeps only the clients of the previous one that match its condition.

export type FunnelStage = { id: string; name: string; total: number };
export type FunnelResult = {
  stages: FunnelStage[];
  byLocation: { id: string; name: string; counts: number[] }[];
  error: string | null;
};

const LABEL_CACHE_MS = 5 * 60 * 1000;
const labelCache = new Map<string, { at: number; phones: Set<string> }>();

async function phonesWithLabelCached(label: string) {
  const hit = labelCache.get(label);
  if (hit && Date.now() - hit.at < LABEL_CACHE_MS) return hit.phones;
  const phones = await phonesWithLabel(label);
  labelCache.set(label, { at: Date.now(), phones });
  return phones;
}

type Scope = {
  clients: string[];
  accessCount: (clientId: string) => number;
  clicked: (clientId: string, blockId: string) => boolean;
};

function narrow(scope: Scope, steps: FunnelStep[], ctx: { optIn: Set<string>; phone: Map<string, string>; labelPhones: Map<string, Set<string>> }) {
  const counts = [scope.clients.length];
  let current = scope.clients;
  for (const step of steps) {
    current = current.filter((id) => {
      switch (step.type) {
        case "OPT_IN":
          return ctx.optIn.has(id);
        case "RETURNED":
          return scope.accessCount(id) >= Math.max(2, Number(step.param) || 2);
        case "BLOCK_CLICK":
          return scope.clicked(id, step.param);
        case "CHATWOOT_LABEL":
          return ctx.labelPhones.get(step.param)?.has(ctx.phone.get(id)!) ?? false;
      }
    });
    counts.push(current.length);
  }
  return counts;
}

export async function computeFunnel(filters: Filters, steps: FunnelStep[]): Promise<FunnelResult> {
  const period = { gte: filters.from, lte: filters.to };
  const [accesses, clicks, locations] = await Promise.all([
    db.access.findMany({ where: { createdAt: period, locationId: filters.location }, select: { clientId: true, locationId: true } }),
    db.portalEvent.findMany({
      where: { type: "BLOCK_CLICK", createdAt: period, locationId: filters.location, mac: { not: null } },
      select: { mac: true, blockId: true, locationId: true },
    }),
    db.location.findMany({ where: { id: filters.location }, select: { id: true, name: true } }),
  ]);

  const clientIds = [...new Set(accesses.map((a) => a.clientId))];
  const clients = await db.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, phone: true, marketingOptIn: true, devices: { select: { mac: true } } },
  });
  const clientByMac = new Map(clients.flatMap((c) => c.devices.map((d) => [d.mac, c.id] as const)));
  const ctx = {
    optIn: new Set(clients.filter((c) => c.marketingOptIn).map((c) => c.id)),
    phone: new Map(clients.map((c) => [c.id, c.phone])),
    labelPhones: new Map<string, Set<string>>(),
  };

  let error: string | null = null;
  for (const label of new Set(steps.filter((s) => s.type === "CHATWOOT_LABEL").map((s) => s.param))) {
    try {
      ctx.labelPhones.set(label, await phonesWithLabelCached(label));
    } catch (e) {
      error = `Não foi possível ler as etiquetas do Chatwoot: ${(e as Error).message}`;
    }
  }

  const scopeFor = (locationId?: string): Scope => {
    const counts = new Map<string, number>();
    for (const a of accesses) if (!locationId || a.locationId === locationId) counts.set(a.clientId, (counts.get(a.clientId) ?? 0) + 1);
    const clickKeys = new Set<string>();
    for (const c of clicks) {
      const clientId = clientByMac.get(c.mac!);
      if (!clientId || (locationId && c.locationId !== locationId)) continue;
      clickKeys.add(`${clientId}|`);
      clickKeys.add(`${clientId}|${c.blockId}`);
    }
    return {
      clients: [...counts.keys()],
      accessCount: (id) => counts.get(id) ?? 0,
      clicked: (id, blockId) => clickKeys.has(`${id}|${blockId}`),
    };
  };

  const totals = narrow(scopeFor(), steps, ctx);
  return {
    stages: [{ id: "base", name: "Conectou no Wi-Fi" }, ...steps].map((s, i) => ({ id: s.id, name: s.name, total: totals[i] })),
    byLocation: locations
      .map((l) => ({ id: l.id, name: l.name, counts: narrow(scopeFor(l.id), steps, ctx) }))
      .filter((l) => l.counts[0] > 0)
      .sort((a, b) => b.counts[0] - a.counts[0]),
    error,
  };
}
