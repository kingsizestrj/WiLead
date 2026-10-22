import type { Client, Location, Router } from "@prisma/client";
import { after } from "next/server";
import { findOrCreateContact, slugLabel, syncContact } from "./chatwoot";
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

async function syncToChatwoot(client: Client, location: Location) {
  const contactId = client.chatwootContactId ?? (await findOrCreateContact(client.phone, client.name));
  if (!client.chatwootContactId) await db.client.update({ where: { id: client.id }, data: { chatwootContactId: contactId } });
  await syncContact({
    contactId,
    locationLabel: `wifi-${slugLabel(location.hotspotServer)}`,
    locationName: location.name,
    optIn: client.marketingOptIn,
    visits: await db.access.count({ where: { clientId: client.id } }),
  });
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

  // Segmentation for campaigns runs after the response so it never delays the login.
  after(() => syncToChatwoot(opts.client, opts.location).catch((error) => console.error("[chatwoot] sync", error)));

  return { ...credentials, minutes };
}
