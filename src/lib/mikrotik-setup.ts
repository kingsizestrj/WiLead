import type { Router } from "@prisma/client";
import type { RouterOSAPI } from "node-routeros";
import { OTP_ADDRESS_LIST, withRouter } from "./mikrotik";

// Everything WiLead needs on a MikroTik, created through the RouterOS API (v6 and v7).
// Objects are found again by name/comment, so every step can run more than once.

export const WILEAD_PROFILE = "wilead";
export const HOTSPOT_NETWORKS_LIST = "redes-hotspot";
const META_LIST = "wilead-meta";
const HTML_DIR = "hotspot";
const COMMENT = {
  portal: "WiLead: portal",
  meta: "WiLead: Meta/WhatsApp",
  otp: "WiLead: WhatsApp para ler o codigo",
  nat: "WiLead: saida dos pontos",
};
// Rule from the first setup.rsc that opened WhatsApp to everyone before login.
const LEGACY_WHATSAPP_COMMENT = "WhatsApp (Meta)";

// Meta (AS32934) blocks used by WhatsApp; see https://bgp.he.net/AS32934
const META_NETWORKS = [
  "31.13.24.0/21", "31.13.64.0/18", "45.64.40.0/22", "57.144.0.0/14", "66.220.144.0/20",
  "69.63.176.0/20", "69.171.224.0/19", "74.119.76.0/22", "102.132.96.0/20", "103.4.96.0/22",
  "129.134.0.0/16", "157.240.0.0/16", "163.70.128.0/17", "173.252.64.0/18", "179.60.192.0/22",
  "185.60.216.0/22", "185.89.216.0/22", "204.15.20.0/22",
];

// Push services that wake WhatsApp up so the code shows as a notification without opening
// the app: Google FCM (any address, 5228-5230) and Apple APNs (17.0.0.0/8, 5223).
const PUSH_RULES = [
  { comment: "WiLead: notificacao Android do codigo", match: ["=protocol=tcp", "=dst-port=5228-5230"] },
  { comment: "WiLead: notificacao iPhone do codigo", match: ["=protocol=tcp", "=dst-port=5223", "=dst-address=17.0.0.0/8"] },
];

type Row = Record<string, string>;

const print = (api: RouterOSAPI, path: string, query: Record<string, string> = {}) =>
  api.write(`${path}/print`, Object.entries(query).map(([k, v]) => `?${k}=${v}`)) as Promise<Row[]>;

async function upsertByComment(api: RouterOSAPI, path: string, comment: string, data: string[]) {
  const [row] = await print(api, path, { comment });
  if (row) await api.write(`${path}/set`, [`=.id=${row[".id"]}`, ...data]);
  else await api.write(`${path}/add`, [...data, `=comment=${comment}`]);
}

export function wileadUrls() {
  const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl) throw new Error("Configure PUBLIC_URL no .env do servidor (ex.: https://wilead.voltecautomacao.com.br)");
  // Address the routers use to download the hotspot pages (an internal URL avoids hairpin NAT).
  const routerUrl = (process.env.ROUTER_FETCH_URL ?? publicUrl).replace(/\/$/, "");
  return { publicUrl, host: new URL(publicUrl).hostname, pagesUrl: `${routerUrl}/mikrotik` };
}

// Hotspot pages WiLead replaces on the router. login.html sends the client to the portal;
// rlogin.html answers any page opened before login (including the phones' captive portal
// check) and redirects straight to the portal, skipping the router's own login page.
const WILEAD_PAGES = ["login.html", "rlogin.html"];

export type CheckItem = { label: string; ok: boolean; detail: string; optional?: boolean };

// How the points' networks reach the internet: src-nat to a public IP (what ISP routers
// usually do), masquerade, or nothing when another router does the NAT.
export type NatMode = { mode: "none" } | { mode: "masquerade" } | { mode: "src-nat"; toAddress: string };

// Public addresses the router already uses in src-nat rules, offered as suggestions.
export async function srcNatAddresses(router: Router) {
  return withRouter(router, async (api) => {
    const rules = await print(api, "/ip/firewall/nat", { chain: "srcnat", action: "src-nat" });
    return [...new Set(rules.map((r) => r["to-addresses"]).filter(Boolean))];
  });
}

export async function routerChecklist(router: Router): Promise<CheckItem[]> {
  const { host } = wileadUrls();
  return withRouter(router, async (api) => {
    const [profile] = await print(api, "/ip/hotspot/profile", { name: WILEAD_PROFILE });
    const [userProfile] = await print(api, "/ip/hotspot/user/profile", { name: router.userProfile });
    const [loginFile] = await print(api, "/file", { name: `${HTML_DIR}/login.html` });
    const [rloginFile] = await print(api, "/file", { name: `${HTML_DIR}/rlogin.html` });
    const [wg] = await print(api, "/ip/hotspot/walled-garden", { comment: COMMENT.portal });
    const [wgIp] = await print(api, "/ip/hotspot/walled-garden/ip", { comment: COMMENT.portal });
    const meta = await print(api, "/ip/firewall/address-list", { list: META_LIST });
    const [otp] = await print(api, "/ip/hotspot/walled-garden/ip", { comment: COMMENT.otp });
    const push = await Promise.all(PUSH_RULES.map((rule) => print(api, "/ip/hotspot/walled-garden/ip", { comment: rule.comment })));
    const legacy = await print(api, "/ip/hotspot/walled-garden/ip", { comment: LEGACY_WHATSAPP_COMMENT });
    const [dns] = (await api.write("/ip/dns/print")) as Row[];
    const [nat] = await print(api, "/ip/firewall/nat", { comment: COMMENT.nat });
    const metaAddresses = new Set(meta.map((m) => m.address));

    return [
      {
        label: `Perfil de hotspot "${WILEAD_PROFILE}"`,
        ok: !!profile && profile["login-by"].includes("http-pap") && profile["html-directory"] === HTML_DIR,
        detail: profile ? `login-by=${profile["login-by"]}, pasta ${profile["html-directory"]}` : "não existe",
      },
      {
        label: `Perfil de usuário "${router.userProfile}"`,
        ok: !!userProfile,
        detail: userProfile ? `usado nos usuários liberados (shared-users=${userProfile["shared-users"]})` : "não existe: a liberação da internet falha",
      },
      {
        label: "login.html do WiLead",
        ok: !!loginFile?.contents?.includes(host),
        detail: loginFile ? (loginFile.contents?.includes(host) ? `aponta para ${host}` : "é outro login.html") : "não instalado",
      },
      {
        label: "rlogin.html do WiLead (portal abre direto)",
        ok: !!rloginFile?.contents?.includes(host),
        detail: rloginFile?.contents?.includes(host)
          ? `o teste do celular vai direto para ${host}`
          : "padrão do MikroTik: passa pela página de login do roteador antes do portal",
      },
      {
        label: "Walled garden do portal",
        ok: wg?.["dst-host"] === host && wgIp?.["dst-host"] === host,
        detail: wg ? `libera ${wg["dst-host"]}` : `falta liberar ${host}`,
      },
      {
        label: "Lista de IPs da Meta (WhatsApp)",
        ok: META_NETWORKS.every((n) => metaAddresses.has(n)),
        detail: `${META_NETWORKS.filter((n) => metaAddresses.has(n)).length} de ${META_NETWORKS.length} blocos`,
      },
      { label: "WhatsApp temporário para ler o código", ok: !!otp, detail: otp ? "regra ativa" : "falta a regra" },
      {
        label: "Notificação do código (Google e Apple)",
        ok: push.every((rows) => rows.length > 0),
        detail: push.every((rows) => rows.length > 0)
          ? "regras ativas"
          : "falta a regra: sem dados móveis, o cliente só vê o código abrindo o WhatsApp",
      },
      {
        label: "WhatsApp liberado para todos antes do login",
        ok: legacy.length === 0,
        detail: legacy.length ? `${legacy.length} regra(s) antiga(s) liberando a Meta para todos` : "nenhuma regra antiga",
      },
      {
        label: "DNS do roteador atendendo os clientes",
        ok: dns["allow-remote-requests"] === "true",
        detail: dns["allow-remote-requests"] === "true" ? "allow-remote-requests ligado" : "desligado: clientes do hotspot não resolvem nomes",
      },
      {
        label: "NAT das redes dos pontos",
        ok: !!nat,
        optional: true,
        detail: nat
          ? nat.action === "src-nat"
            ? `src-nat para ${nat["to-addresses"]}`
            : nat.action
          : "sem regra do WiLead (ok se o NAT é feito em outro roteador)",
      },
    ];
  });
}

// Default hotspot pages only exist after a hotspot server exists: reset-html writes them,
// then the router downloads WiLead's pages over the default ones.
async function installHotspotPages(api: RouterOSAPI) {
  const { pagesUrl } = wileadUrls();
  const servers = (await api.write("/ip/hotspot/print")) as Row[];
  if (!servers.length) return "login.html e rlogin.html serão instalados quando o primeiro ponto for criado";
  const [alogin] = await print(api, "/file", { name: `${HTML_DIR}/alogin.html` });
  if (!alogin) await api.write("/ip/hotspot/reset-html", [`=numbers=${servers[0].name}`]);
  for (const page of WILEAD_PAGES) {
    await api.write("/tool/fetch", [`=url=${pagesUrl}/${page}`, `=dst-path=${HTML_DIR}/${page}`, "=check-certificate=no"]);
  }
  return `login.html e rlogin.html baixados de ${pagesUrl}`;
}

export async function prepareRouter(router: Router, opts: { nat: NatMode; enableDns: boolean }) {
  const { host } = wileadUrls();
  return withRouter(router, async (api) => {
    const log: string[] = [];

    const profile = ["=login-by=http-pap,cookie", "=http-cookie-lifetime=1d", `=html-directory=${HTML_DIR}`];
    const [existing] = await print(api, "/ip/hotspot/profile", { name: WILEAD_PROFILE });
    if (existing) await api.write("/ip/hotspot/profile/set", [`=.id=${existing[".id"]}`, ...profile]);
    else await api.write("/ip/hotspot/profile/add", [`=name=${WILEAD_PROFILE}`, ...profile]);
    log.push(`Perfil "${WILEAD_PROFILE}" com login por http-pap e cookie`);

    // User profile applied to the users WiLead creates (one device per user).
    if (!(await print(api, "/ip/hotspot/user/profile", { name: router.userProfile })).length) {
      await api.write("/ip/hotspot/user/profile/add", [`=name=${router.userProfile}`, "=shared-users=1"]);
      log.push(`Perfil de usuário "${router.userProfile}" criado`);
    }

    await upsertByComment(api, "/ip/hotspot/walled-garden", COMMENT.portal, [`=dst-host=${host}`, "=action=allow"]);
    await upsertByComment(api, "/ip/hotspot/walled-garden/ip", COMMENT.portal, [`=dst-host=${host}`, "=action=accept"]);
    log.push(`Walled garden liberando ${host}`);

    const meta = new Set((await print(api, "/ip/firewall/address-list", { list: META_LIST })).map((m) => m.address));
    for (const net of META_NETWORKS.filter((n) => !meta.has(n))) {
      await api.write("/ip/firewall/address-list/add", [`=list=${META_LIST}`, `=address=${net}`, `=comment=${COMMENT.meta}`]);
    }
    await upsertByComment(api, "/ip/hotspot/walled-garden/ip", COMMENT.otp, [
      "=action=accept",
      `=src-address-list=${OTP_ADDRESS_LIST}`,
      `=dst-address-list=${META_LIST}`,
    ]);
    log.push("WhatsApp liberado só para quem pediu o código (lista da Meta + regra temporária)");

    for (const rule of PUSH_RULES) {
      await upsertByComment(api, "/ip/hotspot/walled-garden/ip", rule.comment, [
        "=action=accept",
        `=src-address-list=${OTP_ADDRESS_LIST}`,
        ...rule.match,
      ]);
    }
    log.push("Notificação do código liberada só para quem pediu o código (Google e Apple)");

    const legacy = await print(api, "/ip/hotspot/walled-garden/ip", { comment: LEGACY_WHATSAPP_COMMENT });
    for (const rule of legacy) await api.write("/ip/hotspot/walled-garden/ip/remove", [`=.id=${rule[".id"]}`]);
    if (legacy.length) log.push(`Removidas ${legacy.length} regras antigas que liberavam o WhatsApp para todos`);

    if (opts.enableDns) {
      await api.write("/ip/dns/set", ["=allow-remote-requests=yes"]);
      log.push("DNS do roteador atendendo os clientes");
    }
    if (opts.nat.mode !== "none") {
      const action = opts.nat.mode === "src-nat" ? ["=action=src-nat", `=to-addresses=${opts.nat.toAddress}`] : ["=action=masquerade"];
      await upsertByComment(api, "/ip/firewall/nat", COMMENT.nat, ["=chain=srcnat", `=src-address-list=${HOTSPOT_NETWORKS_LIST}`, ...action]);
      log.push(
        opts.nat.mode === "src-nat"
          ? `NAT: redes dos pontos saem pelo IP ${opts.nat.toAddress}`
          : `NAT (masquerade) para a lista ${HOTSPOT_NETWORKS_LIST}`,
      );
    }

    log.push(await installHotspotPages(api));
    return log;
  });
}

export type RouterInterface = { name: string; type: string; running: boolean; comment: string };

// Interfaces that can carry the points' VLANs (no bridge/bond members, no dynamic ones).
export async function trunkCandidates(router: Router): Promise<RouterInterface[]> {
  return withRouter(router, async (api) => {
    const rows = (await api.write("/interface/print")) as Row[];
    return rows
      .filter((r) => ["ether", "bond", "bridge"].includes(r.type) && r.slave !== "true" && r.dynamic !== "true")
      .map((r) => ({ name: r.name, type: r.type, running: r.running === "true", comment: r.comment ?? "" }));
  });
}

export function pointNames(slug: string, vlanId: number) {
  return { vlan: `vlan${vlanId}-${slug}`, hotspot: `hs-${slug}`, dhcp: `dhcp-${slug}`, pool: `pool-${slug}` };
}

const ipToInt = (ip: string) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);

function overlaps(cidr: string, network: string) {
  const [ip, bits = "32"] = cidr.split("/");
  const size = 2 ** (32 - Number(bits));
  const start = Math.floor(ipToInt(ip) / size) * size;
  const ours = ipToInt(`${network}.0`);
  return start < ours + 256 && ours < start + size;
}

// Creates a point: VLAN on the trunk, gateway IP, pool, hotspot server (WiLead profile),
// DHCP and the redes-hotspot entry. DHCP comes after the hotspot so a failure never
// leaves clients online without it; anything created is removed again on error.
export async function createPoint(
  router: Router,
  input: { slug: string; trunk: string; vlanId: number; network: string; leaseMinutes: number },
) {
  const names = pointNames(input.slug, input.vlanId);
  const net = input.network;
  return withRouter(router, async (api) => {
    if (!(await print(api, "/ip/hotspot/profile", { name: WILEAD_PROFILE })).length) {
      throw new Error("Prepare o roteador antes de criar pontos (perfil wilead não existe)");
    }
    const [trunk] = await print(api, "/interface", { name: input.trunk });
    if (!trunk) throw new Error(`A interface ${input.trunk} não existe`);
    const [bridgePort] = await print(api, "/interface/bridge/port", { interface: input.trunk });
    if (bridgePort) throw new Error(`${input.trunk} faz parte da bridge ${bridgePort.bridge}: escolha a própria bridge como tronco`);
    if (trunk.type === "bridge") {
      const [bridge] = await print(api, "/interface/bridge", { name: input.trunk });
      if (bridge["vlan-filtering"] === "true") throw new Error(`A bridge ${input.trunk} usa vlan-filtering, que o WiLead ainda não configura`);
    }
    const [sameVlan] = await print(api, "/interface/vlan", { interface: input.trunk, "vlan-id": String(input.vlanId) });
    if (sameVlan) throw new Error(`A VLAN ${input.vlanId} já existe em ${input.trunk} (${sameVlan.name})`);
    if ((await print(api, "/interface", { name: names.vlan })).length) throw new Error(`A interface ${names.vlan} já existe`);
    if ((await print(api, "/ip/hotspot", { name: names.hotspot })).length) throw new Error(`O hotspot ${names.hotspot} já existe`);
    if ((await print(api, "/ip/pool", { name: names.pool })).length) throw new Error(`O pool ${names.pool} já existe (sobra de outra configuração? remova em /ip pool)`);
    if ((await print(api, "/ip/dhcp-server", { name: names.dhcp })).length) throw new Error(`O DHCP ${names.dhcp} já existe (sobra de outra configuração? remova em /ip dhcp-server)`);
    if ((await print(api, "/ip/dhcp-server/network", { address: `${net}.0/24` })).length) {
      throw new Error(`Já existe uma rede de DHCP ${net}.0/24 (sobra de outra configuração? remova em /ip dhcp-server network)`);
    }
    const used = ((await api.write("/ip/address/print")) as Row[]).find((a) => overlaps(a.address, net));
    if (used) throw new Error(`A rede ${net}.0/24 conflita com ${used.address} em ${used.interface}`);
    // Routes learned from OSPF/BGP or static ones also count (the default route does not).
    const route = ((await api.write("/ip/route/print")) as Row[]).find(
      (r) => r["dst-address"] !== "0.0.0.0/0" && r.active === "true" && overlaps(r["dst-address"], net),
    );
    if (route) {
      const origin = route.ospf === "true" ? "OSPF" : route.bgp === "true" ? "BGP" : route.static === "true" ? "rota estática" : "rota";
      throw new Error(`A rede ${net}.0/24 conflita com a ${origin} ${route["dst-address"]} (via ${route.gateway ?? "?"}). Escolha outra faixa.`);
    }

    const created: [string, string][] = [];
    const add = async (label: string, path: string, args: string[]) => {
      try {
        const [res] = (await api.write(`${path}/add`, args)) as Row[];
        created.push([path, res.ret]);
      } catch (error) {
        throw new Error(`Erro ao criar ${label}: ${(error as Error).message}`);
      }
    };
    const comment = `=comment=WiLead: ${input.slug}`;
    try {
      await add(`a VLAN ${names.vlan}`, "/interface/vlan", [`=name=${names.vlan}`, `=vlan-id=${input.vlanId}`, `=interface=${input.trunk}`, comment]);
      await add(`o IP ${net}.1/24`, "/ip/address", [`=address=${net}.1/24`, `=interface=${names.vlan}`, comment]);
      await add(`o pool ${names.pool}`, "/ip/pool", [`=name=${names.pool}`, `=ranges=${net}.10-${net}.254`, comment]);
      await add(`o hotspot ${names.hotspot}`, "/ip/hotspot", [`=name=${names.hotspot}`, `=interface=${names.vlan}`, `=address-pool=${names.pool}`, `=profile=${WILEAD_PROFILE}`, "=disabled=no"]);
      await add(`o DHCP ${names.dhcp}`, "/ip/dhcp-server", [`=name=${names.dhcp}`, `=interface=${names.vlan}`, `=address-pool=${names.pool}`, `=lease-time=${input.leaseMinutes}m`, "=disabled=no"]);
      await add(`a rede de DHCP ${net}.0/24`, "/ip/dhcp-server/network", [`=address=${net}.0/24`, `=gateway=${net}.1`, `=dns-server=${net}.1`, comment]);
      // An entry left by an earlier setup is reused: the list only needs to contain the network.
      if (!(await print(api, "/ip/firewall/address-list", { list: HOTSPOT_NETWORKS_LIST, address: `${net}.0/24` })).length) {
        await add(`a entrada ${net}.0/24 na lista ${HOTSPOT_NETWORKS_LIST}`, "/ip/firewall/address-list", [`=list=${HOTSPOT_NETWORKS_LIST}`, `=address=${net}.0/24`, comment]);
      }
    } catch (error) {
      for (const [path, id] of created.reverse()) await api.write(`${path}/remove`, [`=.id=${id}`]).catch(() => undefined);
      throw error;
    }

    // The first hotspot of the router is what generates the default pages WiLead replaces.
    const loginHtml = await installHotspotPages(api).catch((error: Error) => `login.html e rlogin.html não foram instalados: ${error.message}`);
    return { hotspotServer: names.hotspot, interfaceName: names.vlan, loginHtml };
  });
}

// Removes everything createPoint made for this point (found by the names it used).
export async function removePoint(router: Router, slug: string) {
  return withRouter(router, async (api) => {
    const [hotspot] = await print(api, "/ip/hotspot", { name: `hs-${slug}` });
    const vlan = hotspot?.interface;
    const [address] = vlan ? await print(api, "/ip/address", { interface: vlan }) : [];
    const net = address ? `${address.address.split(".").slice(0, 3).join(".")}.0/24` : null;

    const remove = async (path: string, query: Record<string, string>) => {
      for (const row of await print(api, path, query)) await api.write(`${path}/remove`, [`=.id=${row[".id"]}`]);
    };
    await remove("/ip/hotspot", { name: `hs-${slug}` });
    await remove("/ip/dhcp-server", { name: `dhcp-${slug}` });
    if (net) {
      await remove("/ip/dhcp-server/network", { address: net });
      await remove("/ip/firewall/address-list", { list: HOTSPOT_NETWORKS_LIST, address: net });
    }
    await remove("/ip/pool", { name: `pool-${slug}` });
    if (vlan) {
      await remove("/ip/address", { interface: vlan });
      await remove("/interface/vlan", { name: vlan });
    }
  });
}

export type HotspotStatus = {
  name: string;
  interface: string;
  profile: string;
  disabled: boolean;
  invalid: boolean;
  hosts: number;
  active: number;
  leases: number | null;
};

// What each hotspot server is seeing right now (helps to find VLANs that are not arriving).
export async function hotspotStatus(router: Router): Promise<HotspotStatus[]> {
  return withRouter(router, async (api) => {
    const servers = (await api.write("/ip/hotspot/print")) as Row[];
    const hosts = (await api.write("/ip/hotspot/host/print")) as Row[];
    const active = (await api.write("/ip/hotspot/active/print")) as Row[];
    const dhcp = (await api.write("/ip/dhcp-server/print")) as Row[];
    const leases = (await api.write("/ip/dhcp-server/lease/print")) as Row[];
    return servers.map((s) => {
      const dhcpServer = dhcp.find((d) => d.interface === s.interface);
      return {
        name: s.name,
        interface: s.interface,
        profile: s.profile,
        disabled: s.disabled === "true",
        invalid: s.invalid === "true",
        hosts: hosts.filter((h) => h.server === s.name).length,
        active: active.filter((a) => a.server === s.name).length,
        leases: dhcpServer ? leases.filter((l) => l.server === dhcpServer.name).length : null,
      };
    });
  });
}
