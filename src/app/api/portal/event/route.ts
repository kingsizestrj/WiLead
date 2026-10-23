import { NextResponse, after } from "next/server";
import { z } from "zod";
import { leadLabelOf, type Block } from "@/lib/blocks";
import { addContactLabels, findOrCreateContact } from "@/lib/chatwoot";
import { db } from "@/lib/db";

const schema = z.object({
  type: z.enum(["AD_VIDEO_COMPLETED", "BLOCK_CLICK"]),
  portalId: z.string(),
  locationId: z.string(),
  blockId: z.string().optional(),
  mac: z.string().optional(),
});

// A known device clicking a button with a lead label gets it on its Chatwoot contact now;
// unknown devices get it when they sign up (see leadLabelsClickedBy).
async function labelLead(portalId: string, blockId: string, mac: string) {
  const portal = await db.portal.findUniqueOrThrow({ where: { id: portalId } });
  const block = (portal.blocks as Block[]).find((b) => b.id === blockId);
  const label = block && leadLabelOf(block);
  if (!label) return;
  const device = await db.device.findUnique({ where: { mac }, include: { client: true } });
  if (!device) return;
  const contactId = device.client.chatwootContactId ?? (await findOrCreateContact(device.client.phone, device.client.name));
  await addContactLabels(contactId, [label]);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });
  await db.portalEvent.create({ data: parsed.data });

  const { type, portalId, blockId, mac } = parsed.data;
  if (type === "BLOCK_CLICK" && blockId && mac) {
    after(() => labelLead(portalId, blockId, mac).catch((error) => console.error("[chatwoot] etiqueta de lead", error)));
  }
  return NextResponse.json({ ok: true });
}
