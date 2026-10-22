import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, getSettings } from "@/lib/db";
import { normalizeMac, normalizePhone } from "@/lib/phone";
import { sendOtp } from "@/lib/chatwoot";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string(),
  email: z.string().trim().email().optional().or(z.literal("")),
  optIn: z.boolean(),
  mac: z.string(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  const mac = parsed.success ? normalizeMac(parsed.data.mac) : null;
  if (!parsed.success || !phone || !mac) {
    return NextResponse.json({ error: "Confira seu nome e telefone." }, { status: 422 });
  }

  const settings = await getSettings();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.otpCode.count({
    where: { createdAt: { gte: since }, OR: [{ phone }, { mac }] },
  });
  if (recent >= settings.otpMaxPerHour) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otp = await db.otpCode.create({
    data: {
      phone,
      mac,
      name: parsed.data.name,
      email: parsed.data.email || null,
      optIn: parsed.data.optIn,
      codeHash: await bcrypt.hash(code, 8),
      expiresAt: new Date(Date.now() + settings.otpTtlMinutes * 60 * 1000),
    },
  });

  try {
    await sendOtp(phone, parsed.data.name, code);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Não conseguimos enviar o código no WhatsApp. Confira o número." }, { status: 502 });
  }

  return NextResponse.json({ otpId: otp.id });
}
