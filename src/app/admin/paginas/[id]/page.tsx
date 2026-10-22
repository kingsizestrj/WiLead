import type { Block, Theme } from "@/lib/blocks";
import { db } from "@/lib/db";
import { Builder } from "./Builder";

export default async function EditPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const portal = await db.portal.findUniqueOrThrow({ where: { id: (await params).id } });
  return (
    <Builder
      id={portal.id}
      initial={{
        name: portal.name,
        welcomeTitle: portal.welcomeTitle,
        theme: portal.theme as Theme,
        blocks: portal.blocks as Block[],
        adVideoUrl: portal.adVideoUrl ?? "",
        adSeconds: portal.adSeconds,
        instagram: portal.instagram ?? "",
        redirectUrl: portal.redirectUrl ?? "",
        termsText: portal.termsText,
      }}
    />
  );
}
