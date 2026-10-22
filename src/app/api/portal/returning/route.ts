import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeMac } from "@/lib/phone";
import { grantAccess, resolveLocation } from "@/lib/portal";

const schema = z.object({
  mac: z.string(),
  ip: z.string(),
  server: z.string().min(1),
  // $(interface-name); older login pages do not send it
  iface: z.string().default(""),
});

// A device that was already verified only confirms its identity (no new OTP).
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  const mac = parsed.success ? normalizeMac(parsed.data.mac) : null;
  if (!parsed.success || !mac) return NextResponse.json({ error: "Dispositivo inválido." }, { status: 422 });

  const device = await db.device.findUnique({ where: { mac }, include: { client: true } });
  if (!device) return NextResponse.json({ error: "Dispositivo não cadastrado." }, { status: 404 });

  try {
    const access = await grantAccess({
      client: device.client,
      mac,
      ip: parsed.data.ip,
      userAgent: req.headers.get("user-agent"),
      location: await resolveLocation(parsed.data.server, parsed.data.iface),
      type: "RETURNING",
    });
    return NextResponse.json(access);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao liberar a internet. Tente novamente." }, { status: 502 });
  }
}
