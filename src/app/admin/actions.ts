"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_THEME, newBlock, type Block, type Theme } from "@/lib/blocks";
import { locationLabel, renameLabel, slugLabel } from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { createTemplate, deleteTemplate, type NewTemplate } from "@/lib/meta-templates";
import { testRouter } from "@/lib/mikrotik";
import { createPoint, prepareRouter, removePoint } from "@/lib/mikrotik-setup";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => str(f, k) || null;
const optionalInt = (f: FormData, k: string) => (str(f, k) ? Number(str(f, k)) : null);

export async function createLocation(form: FormData) {
  await requireAdmin();
  const routers = await db.router.findMany({ take: 2 });
  await db.location.create({
    data: { name: str(form, "name"), city: optional(form, "city"), routerId: routers.length === 1 ? routers[0].id : null },
  });
  revalidatePath("/admin/locais");
}

export async function updateLocation(id: string, form: FormData) {
  await requireAdmin();
  const before = await db.location.findUniqueOrThrow({ where: { id } });
  const location = await db.location.update({
    where: { id },
    data: {
      name: str(form, "name"),
      city: optional(form, "city"),
      sessionMinutes: optionalInt(form, "sessionMinutes"),
      routerId: optional(form, "routerId"),
      portalId: optional(form, "portalId"),
    },
  });
  // Keeps the campaign audience: contacts already tagged with the old name get the new label.
  await renameLabel(locationLabel(before.name), locationLabel(location.name)).catch((error) =>
    console.error("[chatwoot] renomear etiqueta", error),
  );
  revalidatePath("/admin/locais");
}

// Moves a source (hotspot server + interface) to another location. Moving the last source
// merges the points: its history goes along and the emptied location is removed.
export async function moveLocationSource(sourceId: string, form: FormData) {
  await requireAdmin();
  const targetId = str(form, "locationId");
  const source = await db.locationSource.findUniqueOrThrow({
    where: { id: sourceId },
    include: { location: { include: { _count: { select: { sources: true } } } } },
  });
  const from = source.location;
  if (from.id === targetId) return;

  if (from._count.sources > 1) {
    await db.locationSource.update({ where: { id: sourceId }, data: { locationId: targetId } });
  } else {
    const target = await db.location.findUniqueOrThrow({ where: { id: targetId } });
    const moved = { where: { locationId: from.id }, data: { locationId: targetId } };
    await db.$transaction([
      db.locationSource.update({ where: { id: sourceId }, data: { locationId: targetId } }),
      db.access.updateMany(moved),
      db.accessFailure.updateMany(moved),
      db.portalEvent.updateMany(moved),
      db.client.updateMany({ where: { firstLocationId: from.id }, data: { firstLocationId: targetId } }),
      db.location.delete({ where: { id: from.id } }),
    ]);
    await renameLabel(locationLabel(from.name), locationLabel(target.name)).catch((error) =>
      console.error("[chatwoot] juntar etiqueta", error),
    );
  }
  revalidatePath("/admin/locais");
}

export async function deleteLocation(id: string) {
  await requireAdmin();
  const location = await db.location.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { sources: true, accesses: true } } },
  });
  if (location._count.sources || location._count.accesses) throw new Error("Só é possível excluir um local sem origens e sem acessos.");
  await db.location.delete({ where: { id } });
  revalidatePath("/admin/locais");
}

export async function saveRouter(id: string | null, form: FormData) {
  await requireAdmin();
  const data = {
    name: str(form, "name"),
    host: str(form, "host"),
    port: Number(str(form, "port")),
    useTls: form.get("useTls") === "on",
    username: str(form, "username"),
    userProfile: str(form, "userProfile") || "default",
    insecureTls: form.get("insecureTls") === "on",
  };
  const password = str(form, "password");
  if (id) await db.router.update({ where: { id }, data: { ...data, ...(password && { password }) } });
  else {
    const router = await db.router.create({ data: { ...data, password } });
    // First router: locations that showed up before it was registered start using it.
    if ((await db.router.count()) === 1) await db.location.updateMany({ where: { routerId: null }, data: { routerId: router.id } });
  }
  revalidatePath("/admin/roteadores");
  revalidatePath("/admin/locais");
}

export async function deleteRouter(id: string) {
  await requireAdmin();
  await db.router.delete({ where: { id } });
  revalidatePath("/admin/roteadores");
}

export async function testRouterConnection(id: string) {
  await requireAdmin();
  try {
    const info = await testRouter(await db.router.findUniqueOrThrow({ where: { id } }));
    return `✅ ${info.identity} — ${info.board} — RouterOS ${info.version}`;
  } catch (error) {
    return `❌ ${(error as Error).message}`;
  }
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  await db.setting.update({
    where: { id: 1 },
    data: {
      sessionMinutes: Number(str(form, "sessionMinutes")),
      otpTtlMinutes: Number(str(form, "otpTtlMinutes")),
      otpMaxPerHour: Number(str(form, "otpMaxPerHour")),
      otpWhatsappMinutes: Number(str(form, "otpWhatsappMinutes")),
    },
  });
  revalidatePath("/admin/config");
}

export async function createPortal() {
  await requireAdmin();
  const hasDefault = await db.portal.count({ where: { isDefault: true } });
  const portal = await db.portal.create({
    data: { name: "Nova landing page", isDefault: !hasDefault, theme: DEFAULT_THEME, blocks: [newBlock("hero")] },
  });
  redirect(`/admin/paginas/${portal.id}`);
}

export async function duplicatePortal(id: string) {
  await requireAdmin();
  const { id: _id, createdAt: _c, updatedAt: _u, isDefault: _d, ...rest } = await db.portal.findUniqueOrThrow({ where: { id } });
  const copy = await db.portal.create({ data: { ...rest, theme: rest.theme!, blocks: rest.blocks!, name: `${rest.name} (cópia)` } });
  redirect(`/admin/paginas/${copy.id}`);
}

export async function setDefaultPortal(id: string) {
  await requireAdmin();
  await db.$transaction([
    db.portal.updateMany({ data: { isDefault: false } }),
    db.portal.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/admin/paginas");
}

export async function deletePortal(id: string) {
  await requireAdmin();
  const portal = await db.portal.findUniqueOrThrow({ where: { id } });
  if (portal.isDefault) throw new Error("Defina outra página como padrão antes de excluir esta.");
  await db.portal.delete({ where: { id } });
  revalidatePath("/admin/paginas");
}

export type PortalInput = {
  name: string;
  welcomeTitle: string;
  theme: Theme;
  blocks: Block[];
  adVideoUrl: string;
  adSeconds: number;
  instagram: string;
  redirectUrl: string;
  termsText: string;
};

export async function savePortal(id: string, input: PortalInput) {
  await requireAdmin();
  await db.portal.update({
    where: { id },
    data: {
      ...input,
      adVideoUrl: input.adVideoUrl || null,
      instagram: input.instagram || null,
      redirectUrl: input.redirectUrl || null,
    },
  });
  revalidatePath("/admin/paginas");
}

export async function changePassword(form: FormData) {
  const userId = await requireAdmin();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: userId } });
  const password = str(form, "password");
  if (!(await bcrypt.compare(str(form, "current"), user.passwordHash))) redirect("/admin/config?senha=atual-invalida");
  if (password.length < 8 || password !== str(form, "confirm")) redirect("/admin/config?senha=nova-invalida");
  await db.adminUser.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  redirect("/admin/config?senha=ok");
}

export async function createWhatsappTemplate(input: NewTemplate): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await createTemplate(input);
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath("/admin/templates");
  return {};
}

export async function deleteWhatsappTemplate(name: string) {
  await requireAdmin();
  await deleteTemplate(name);
  revalidatePath("/admin/templates");
}

type ActionResult = { log?: string[]; ok?: string; error?: string } | null;

export async function prepareRouterAction(routerId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const router = await db.router.findUniqueOrThrow({ where: { id: routerId } });
  try {
    const natMode = str(form, "natMode");
    const toAddress = str(form, "natAddress");
    if (natMode === "src-nat" && !/^(\d{1,3}\.){3}\d{1,3}$/.test(toAddress)) return { error: "Informe o IP público de saída (ex.: 168.232.244.79)." };
    const nat = natMode === "src-nat" ? { mode: "src-nat" as const, toAddress } : natMode === "masquerade" ? { mode: "masquerade" as const } : { mode: "none" as const };
    const log = await prepareRouter(router, { nat, enableDns: form.get("enableDns") === "on" });
    revalidatePath(`/admin/roteadores/${routerId}`);
    return { log };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// Accepts "10.5.1", "10.5.1.0" or "10.5.1.0/24" and returns the first three octets.
function parseNetwork(value: string) {
  const octets = value.replace(/\/24$/, "").split(".").filter((o, i) => i < 3 || o !== "0");
  const valid = octets.length === 3 && octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
  return valid ? octets.join(".") : null;
}

export async function createPointAction(routerId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = str(form, "name");
  const slug = slugLabel(name).slice(0, 20).replace(/-$/, "");
  const vlanId = Number(str(form, "vlanId"));
  const network = parseNetwork(str(form, "network"));
  const leaseMinutes = Number(str(form, "leaseMinutes"));
  if (!slug) return { error: "Dê um nome ao ponto." };
  if (!Number.isInteger(vlanId) || vlanId < 2 || vlanId > 4094) return { error: "A VLAN precisa ser um número de 2 a 4094." };
  if (!network) return { error: "Informe a rede /24 do ponto, por exemplo 10.5.1.0/24." };
  if (!Number.isInteger(leaseMinutes) || leaseMinutes < 5) return { error: "O tempo de DHCP precisa ser de pelo menos 5 minutos." };

  const router = await db.router.findUniqueOrThrow({ where: { id: routerId } });
  try {
    const point = await createPoint(router, { slug, trunk: str(form, "trunk"), vlanId, network, leaseMinutes });
    const location = await db.location.create({ data: { name, city: optional(form, "city"), routerId, mikrotikSlug: slug } });
    const source = { hotspotServer: point.hotspotServer, interfaceName: point.interfaceName };
    await db.locationSource.upsert({
      where: { hotspotServer_interfaceName: source },
      update: { locationId: location.id },
      create: { ...source, locationId: location.id },
    });
    revalidatePath(`/admin/roteadores/${routerId}`);
    revalidatePath("/admin/locais");
    return { ok: `Ponto "${name}" criado: ${point.hotspotServer} na ${point.interfaceName}, rede ${network}.0/24. ${point.loginHtml}.` };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function removePointAction(locationId: string) {
  await requireAdmin();
  const location = await db.location.findUniqueOrThrow({ where: { id: locationId }, include: { router: true } });
  if (!location.router || !location.mikrotikSlug) throw new Error("Este local não foi criado pelo painel no MikroTik.");
  await removePoint(location.router, location.mikrotikSlug);
  await db.location.update({ where: { id: locationId }, data: { mikrotikSlug: null } });
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/roteadores/${location.router.id}`);
}
