import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  type: z.enum(["AD_VIDEO_COMPLETED", "BLOCK_CLICK"]),
  portalId: z.string(),
  locationId: z.string(),
  blockId: z.string().optional(),
  mac: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });
  await db.portalEvent.create({ data: parsed.data });
  return NextResponse.json({ ok: true });
}
