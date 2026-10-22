import type { Client, Location, Router } from "@prisma/client";
import { db, getSettings } from "./db";
import { upsertHotspotUser } from "./mikrotik";

// Hotspot parameters forwarded by the MikroTik login.html redirect.
export type HotspotParams = {
  mac: string;
  ip: string;
  server: string;
  loginUrl: string;
  dst: string;
};

// Locations are auto-registered the first time a hotspot server sends a client,
// so the admin only needs to rename them and link a router/portal.
export async function resolveLocation(server: string) {
  return db.location.upsert({
    where: { hotspotServer: server },
    update: {},
    create: { hotspotServer: server, name: server },
    include: { router: true, portal: true },
  });
}

export async function resolvePortal(location: Location) {
  if (location.portalId) return db.portal.findUniqueOrThrow({ where: { id: location.portalId } });
  return db.portal.findFirstOrThrow({ where: { isDefault: true } });
}

export async function grantAccess(opts: {
  client: Client;
  mac: string;
  ip: string;
  userAgent: string | null;
  location: Location & { router: Router | null };
  type: "NEW" | "RETURNING";
}) {
  const settings = await getSettings();
  const minutes = opts.location.sessionMinutes ?? settings.sessionMinutes;

  const device = await db.device.upsert({
    where: { mac: opts.mac },
    update: { clientId: opts.client.id, lastSeenAt: new Date(), userAgent: opts.userAgent },
    create: { mac: opts.mac, clientId: opts.client.id, userAgent: opts.userAgent },
  });

  const credentials = await upsertHotspotUser(opts.location.router, {
    mac: opts.mac,
    minutes,
    comment: `${opts.client.name} | ${opts.client.phone}`,
  });

  await db.access.create({
    data: {
      type: opts.type,
      clientId: opts.client.id,
      deviceId: device.id,
      locationId: opts.location.id,
      ip: opts.ip,
      grantedMinutes: minutes,
    },
  });

  return { ...credentials, minutes };
}
