"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_THEME, newBlock, type Block, type Theme } from "@/lib/blocks";
import { db } from "@/lib/db";
import { testRouter } from "@/lib/mikrotik";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => str(f, k) || null;
const optionalInt = (f: FormData, k: string) => (str(f, k) ? Number(str(f, k)) : null);

export async function updateLocation(id: string, form: FormData) {
  await requireAdmin();
  await db.location.update({
    where: { id },
    data: {
      name: str(form, "name"),
      city: optional(form, "city"),
      sessionMinutes: optionalInt(form, "sessionMinutes"),
      routerId: optional(form, "routerId"),
      portalId: optional(form, "portalId"),
    },
  });
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
  else await db.router.create({ data: { ...data, password } });
  revalidatePath("/admin/roteadores");
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
