import type { Router } from "@prisma/client";
import { RouterOSAPI } from "node-routeros";

// RouterOS API (services "api" 8728 / "api-ssl" 8729) — works on RouterOS v6 and v7.
async function withRouter<T>(router: Router, fn: (api: RouterOSAPI) => Promise<T>) {
  const api = new RouterOSAPI({
    host: router.host,
    port: router.port,
    user: router.username,
    password: router.password,
    timeout: 8,
    tls: router.useTls ? { rejectUnauthorized: !router.insecureTls } : undefined,
  });
  await api.connect();
  try {
    return await fn(api);
  } finally {
    await api.close();
  }
}

export async function testRouter(router: Router) {
  return withRouter(router, async (api) => {
    const [identity] = await api.write("/system/identity/print");
    const [resource] = await api.write("/system/resource/print");
    return { identity: identity.name as string, version: resource.version as string, board: resource["board-name"] as string };
  });
}

function uptimeLimit(minutes: number) {
  return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

// Creates or refreshes a hotspot user locked to the device MAC with an uptime limit.
// Returns credentials that the client's browser sends to $(link-login-only).
export async function upsertHotspotUser(router: Router | null, opts: { mac: string; minutes: number; comment: string }) {
  const username = opts.mac;
  const password = crypto.randomUUID().slice(0, 12);

  if (process.env.HOTSPOT_DRY_RUN === "true") {
    console.log(`[mikrotik:dry-run] user=${username} limit=${uptimeLimit(opts.minutes)} (${opts.comment})`);
    return { username, password };
  }
  if (!router) throw new Error("Nenhum roteador vinculado a este local");

  const data = [
    `=password=${password}`,
    `=mac-address=${opts.mac}`,
    `=limit-uptime=${uptimeLimit(opts.minutes)}`,
    `=profile=${router.userProfile}`,
    `=comment=${opts.comment}`,
  ];

  await withRouter(router, async (api) => {
    const [existing] = await api.write("/ip/hotspot/user/print", [`?name=${username}`]);
    if (existing) {
      await api.write("/ip/hotspot/user/set", [`=.id=${existing[".id"]}`, ...data]);
      await api.write("/ip/hotspot/user/reset-counters", [`=.id=${existing[".id"]}`]);
    } else {
      await api.write("/ip/hotspot/user/add", [`=name=${username}`, ...data]);
    }
  });

  return { username, password };
}

export const OTP_ADDRESS_LIST = "wilead-otp";

// Lets a not-yet-logged-in device reach WhatsApp for a few minutes so it can read the code.
// The walled garden accepts src-address-list=wilead-otp to dst-address-list=wilead-meta,
// and RouterOS drops the entry by itself when the timeout ends.
export async function allowWhatsappTemporarily(router: Router | null, ip: string, minutes: number) {
  if (process.env.HOTSPOT_DRY_RUN === "true") {
    console.log(`[mikrotik:dry-run] ${OTP_ADDRESS_LIST} += ${ip} por ${minutes}m`);
    return;
  }
  if (!router) throw new Error("Nenhum roteador vinculado a este local");

  await withRouter(router, async (api) => {
    const existing = await api.write("/ip/firewall/address-list/print", [`?list=${OTP_ADDRESS_LIST}`, `?address=${ip}`]);
    for (const entry of existing) await api.write("/ip/firewall/address-list/remove", [`=.id=${entry[".id"]}`]);
    await api.write("/ip/firewall/address-list/add", [
      `=list=${OTP_ADDRESS_LIST}`,
      `=address=${ip}`,
      `=timeout=${minutes}m`,
      "=comment=WiLead: lendo o código no WhatsApp",
    ]);
  });
}
