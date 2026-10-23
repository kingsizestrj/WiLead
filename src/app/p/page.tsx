import type { Metadata } from "next";
import { PortalShell } from "@/components/PortalShell";
import type { Block, Theme } from "@/lib/blocks";
import { db } from "@/lib/db";
import { maskPhone, normalizeMac } from "@/lib/phone";
import { pendingOtps, resolveLocation, resolvePortal } from "@/lib/portal";
import { PortalFlow } from "./PortalFlow";

export const metadata: Metadata = { title: "Wi-Fi" };

type Search = Record<string, string | undefined>;

// Entry point of the captive portal. MikroTik's login.html redirects here with
// ?mac=$(mac)&ip=$(ip)&server=$(server-name)&iface=$(interface-name)&login=$(link-login-only)&dst=$(link-orig-esc)&error=$(error)
export default async function PortalPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const mac = normalizeMac(params.mac ?? "");

  if (!mac || !params.server || !params.login) {
    return (
      <main className="grid min-h-full place-items-center p-8 text-center">
        <p>Conecte-se à rede Wi-Fi para acessar esta página.</p>
      </main>
    );
  }

  const location = await resolveLocation(params.server, params.iface ?? "");
  const portal = await resolvePortal(location);
  const device = await db.device.findUnique({ where: { mac }, include: { client: true } });
  // Leaving to read the code in WhatsApp reloads the captive portal window, so a code
  // already sent to this device is resumed instead of starting the sign-up again.
  const [pendingOtp] = await pendingOtps(mac);

  await db.portalEvent.create({ data: { type: "VIEW", portalId: portal.id, locationId: location.id, mac } });

  return (
    <PortalShell theme={portal.theme as Theme} title={portal.welcomeTitle} place={location.city ? `${location.name} · ${location.city}` : undefined}>
      <PortalFlow
        hotspot={{ mac, ip: params.ip ?? "", server: params.server, iface: params.iface ?? "", loginUrl: params.login, dst: params.dst ?? "" }}
        portal={{
          id: portal.id,
          blocks: portal.blocks as Block[],
          adVideoUrl: portal.adVideoUrl,
          adSeconds: portal.adSeconds,
          termsText: portal.termsText,
        }}
        locationId={location.id}
        known={device ? { name: device.client.name.split(" ")[0], phone: maskPhone(device.client.phone) } : null}
        pending={pendingOtp ? { otpId: pendingOtp.id, phone: maskPhone(pendingOtp.phone) } : null}
        routerError={params.error ?? null}
      />
    </PortalShell>
  );
}
