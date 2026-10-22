import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeMac } from "@/lib/phone";
import { grantAccess, resolveLocation } from "@/lib/portal";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  otpId: z.string(),
  code: z.string().regex(/^\d{6}$/),
  mac: z.string(),
  ip: z.string(),
  server: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  const mac = parsed.success ? normalizeMac(parsed.data.mac) : null;
  if (!parsed.success || !mac) return NextResponse.json({ error: "Código inválido." }, { status: 422 });

  const otp = await db.otpCode.findUnique({ where: { id: parsed.data.otpId } });
  if (!otp || otp.mac !== mac || otp.consumedAt || otp.expiresAt < new Date() || otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Código expirado. Peça um novo." }, { status: 410 });
  }

  if (!(await bcrypt.compare(parsed.data.code, otp.codeHash))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Código incorreto." }, { status: 422 });
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const location = await resolveLocation(parsed.data.server);
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
    return NextResponse.json(access);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao liberar a internet. Tente novamente." }, { status: 502 });
  }
}
