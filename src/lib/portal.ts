import { Prisma, type Client, type Location, type Router } from "@prisma/client";
import { after } from "next/server";
import { leadLabelOf, type Block } from "./blocks";
import { findOrCreateContact, locationLabel, syncContact } from "./chatwoot";
import { db, getSettings } from "./db";
import { upsertHotspotUser } from "./mikrotik";

// Hotspot parameters forwarded by the MikroTik login.html redirect.
export type HotspotParams = {
  mac: string;
  ip: string;
  server: string;
  // $(interface-name): port/VLAN the client came in on (empty with older login pages)
  iface: string;
  loginUrl: string;
  dst: string;
};

const locationInclude = { router: true, portal: true } satisfies Prisma.LocationInclude;

// A location is found by its source (hotspot server + interface). An unknown source
// registers a new location named after it, so the admin only renames or merges it.
// With a single router (one MikroTik serving every point) it is linked right away.
export async function resolveLocation(server: string, iface: string) {
  const key = { hotspotServer_interfaceName: { hotspotServer: server, interfaceName: iface } };
  const source = await db.locationSource.findUnique({ where: key, include: { location: { include: locationInclude } } });
  if (source) return source.location;

  const routers = await db.router.findMany({ take: 2 });
  try {
    const created = await db.locationSource.create({
      data: {
        hotspotServer: server,
        interfaceName: iface,
        location: {
          create: { name: iface ? `${server} · ${iface}` : server, routerId: routers.length === 1 ? routers[0].id : null },
        },
      },
      include: { location: { include: locationInclude } },
    });
    return created.location;
  } catch (error) {
    // Two first clients from the same source at once: the other request created it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return (await db.locationSource.findUniqueOrThrow({ where: key, include: { location: { include: locationInclude } } })).location;
    }
    throw error;
  }
}

export async function resolvePortal(location: Location) {
  if (location.portalId) return db.portal.findUniqueOrThrow({ where: { id: location.portalId } });
  return db.portal.findFirstOrThrow({ where: { isDefault: true } });
}

export const OTP_MAX_ATTEMPTS = 5;

// Codes sent to the device that can still be typed, newest first.
export function pendingOtps(mac: string) {
  return db.otpCode.findMany({
    where: { mac, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
  });
}

const LEAD_CLICK_WINDOW = 7 * 24 * 60 * 60 * 1000;

// Lead labels of the landing page buttons this device clicked recently (also before signing up).
export async function leadLabelsClickedBy(mac: string) {
  const clicks = await db.portalEvent.findMany({
    where: { type: "BLOCK_CLICK", mac, createdAt: { gte: new Date(Date.now() - LEAD_CLICK_WINDOW) } },
    distinct: ["portalId", "blockId"],
    select: { portalId: true, blockId: true },
  });
  if (!clicks.length) return [];
  const portals = await db.portal.findMany({ where: { id: { in: clicks.map((c) => c.portalId) } } });
  const labels = clicks.map((c) => {
    const block = (portals.find((p) => p.id === c.portalId)?.blocks as Block[] | undefined)?.find((b) => b.id === c.blockId);
    return block ? leadLabelOf(block) : null;
  });
  return [...new Set(labels.filter((l): l is string => !!l))];
}

async function syncToChatwoot(client: Client, location: Location, mac: string) {
  const contactId = client.chatwootContactId ?? (await findOrCreateContact(client.phone, client.name));
  if (!client.chatwootContactId) await db.client.update({ where: { id: client.id }, data: { chatwootContactId: contactId } });
  await syncContact({
    contactId,
    locationLabel: locationLabel(location.name),
    locationName: location.name,
    optIn: client.marketingOptIn,
    visits: await db.access.count({ where: { clientId: client.id } }),
    leadLabels: await leadLabelsClickedBy(mac),
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
  }).catch(async (error: Error) => {
    await db.accessFailure.create({
      data: { locationId: opts.location.id, mac: opts.mac, clientName: opts.client.name, error: error.message },
    });
    throw error;
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
  after(() => syncToChatwoot(opts.client, opts.location, opts.mac).catch((error) => console.error("[chatwoot] sync", error)));

  return { ...credentials, minutes };
}
