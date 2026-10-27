import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeMac } from "@/lib/phone";
import { grantAccess, pendingOtps, resolveLocation } from "@/lib/portal";

const schema = z.object({
  otpId: z.string(),
  code: z.string().regex(/^\d{6}$/),
  mac: z.string(),
  ip: z.string(),
  server: z.string().min(1),
  // $(interface-name); older login pages do not send it
  iface: z.string().default(""),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  const mac = parsed.success ? normalizeMac(parsed.data.mac) : null;
  if (!parsed.success || !mac) return NextResponse.json({ error: "Código inválido." }, { status: 422 });

  const pending = await pendingOtps(mac);
  const current = pending.find((o) => o.id === parsed.data.otpId);
  if (!current) {
    return NextResponse.json({ error: "Código expirado. Peça um novo." }, { status: 410 });
  }

  // Clients often tap "Reenviar" and then type the code of an earlier message, so any
  // pending code of the device is accepted; wrong attempts count on the code on screen.
  let otp: (typeof pending)[number] | undefined;
  for (const candidate of pending) {
    if (await bcrypt.compare(parsed.data.code, candidate.codeHash)) {
      otp = candidate;
      break;
    }
  }
  if (!otp) {
    await db.otpCode.update({ where: { id: current.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Código incorreto." }, { status: 422 });
  }

  const location = await resolveLocation(parsed.data.server, parsed.data.iface);
  const existing = await db.client.findUnique({ where: { phone: otp.phone } });
  const client = await db.client.upsert({
    where: { phone: otp.phone },
    update: { name: otp.name, email: otp.email ?? undefined, marketingOptIn: otp.optIn, verifiedAt: new Date() },
    create: {
      phone: otp.phone,
      name: otp.name,
      email: otp.email,
      marketingOptIn: otp.optIn,
      verifiedAt: new Date(),
      firstLocationId: location.id,
    },
  });

  try {
    const access = await grantAccess({
      client,
      mac,
      ip: parsed.data.ip,
      userAgent: req.headers.get("user-agent"),
      location,
      type: existing ? "RETURNING" : "NEW",
    });
    // Closed only once the internet is released, so a router failure can be retried with the
    // same code; the device's other codes are closed too, so the portal stops resuming them.
    await db.otpCode.updateMany({ where: { id: { in: pending.map((o) => o.id) } }, data: { consumedAt: new Date() } });
    return NextResponse.json(access);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao liberar a internet. Tente novamente." }, { status: 502 });
  }
}
