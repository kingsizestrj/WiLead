import { Agent } from "undici";
import type { Router } from "@prisma/client";

// Minimal client for the RouterOS v7 REST API (/rest/...).
async function call(router: Router, method: string, path: string, body?: unknown) {
  const url = `${router.apiUrl.replace(/\/$/, "")}/rest${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${router.username}:${router.password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // @ts-expect-error undici dispatcher is supported by Node's fetch
    dispatcher: router.insecureTls ? new Agent({ connect: { rejectUnauthorized: false } }) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MikroTik ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function testRouter(router: Router) {
  const identity = await call(router, "GET", "/system/identity");
  const resource = await call(router, "GET", "/system/resource");
  return { identity: identity.name as string, version: resource.version as string, board: resource["board-name"] as string };
}

function uptimeLimit(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m}m`;
}

// Creates or refreshes a hotspot user locked to the device MAC with an uptime limit.
// Returns credentials that the client's browser posts to $(link-login-only).
export async function upsertHotspotUser(
  router: Router | null,
  opts: { mac: string; minutes: number; comment: string },
) {
  const username = opts.mac;
  const password = crypto.randomUUID().slice(0, 12);

  if (process.env.HOTSPOT_DRY_RUN === "true") {
    console.log(`[mikrotik:dry-run] user=${username} limit=${uptimeLimit(opts.minutes)} (${opts.comment})`);
    return { username, password };
  }
  if (!router) throw new Error("Nenhum roteador vinculado a este local");

  const data = {
    password,
    "mac-address": opts.mac,
    "limit-uptime": uptimeLimit(opts.minutes),
    profile: router.userProfile,
    comment: opts.comment,
  };

  const existing = (await call(router, "GET", `/ip/hotspot/user?name=${encodeURIComponent(username)}`)) as { ".id": string }[];
  if (existing.length) {
    const id = existing[0][".id"];
    await call(router, "PATCH", `/ip/hotspot/user/${id}`, data);
    await call(router, "POST", "/ip/hotspot/user/reset-counters", { ".id": id });
  } else {
    await call(router, "PUT", "/ip/hotspot/user", { name: username, ...data });
  }

  return { username, password };
}
