"use client";

import type { Block } from "@/lib/blocks";
import { BlocksRenderer } from "./BlocksRenderer";

// Blocks with click tracking for pages outside the portal flow (e.g. "Você está conectado").
export function TrackedBlocks({ blocks, portalId, locationId, mac }: { blocks: Block[]; portalId: string; locationId: string; mac: string }) {
  const track = (blockId: string) =>
    navigator.sendBeacon?.(
      "/api/portal/event",
      new Blob([JSON.stringify({ type: "BLOCK_CLICK", portalId, locationId, blockId, mac })], { type: "application/json" }),
    );
  return <BlocksRenderer blocks={blocks} onClick={track} />;
}
