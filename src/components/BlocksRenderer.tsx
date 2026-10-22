"use client";

import { useState } from "react";
import type { Block } from "@/lib/blocks";

function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1];
}

function Video({ url, className }: { url: string; className?: string }) {
  const yt = youtubeId(url);
  if (yt) {
    return (
      <iframe
        className={`aspect-video w-full ${className ?? ""}`}
        src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&playsinline=1`}
        allow="autoplay; encrypted-media"
      />
    );
  }
  return <video className={`w-full ${className ?? ""}`} src={url} autoPlay muted loop playsInline controls />;
}

function Carousel({ images }: { images: string[] }) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className="h-56 w-[85%] shrink-0 snap-center rounded-2xl object-cover" />
      ))}
    </div>
  );
}

function Coupon({ block }: { block: Extract<Block, { type: "coupon" }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-3xl border-2 border-dashed border-white/40 bg-white/10 p-5 text-center backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] opacity-70">Cupom exclusivo Wi-Fi</p>
      <p className="mt-1 text-3xl font-black">{block.title}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(block.code);
          setCopied(true);
        }}
        className="mt-3 rounded-xl bg-white px-5 py-2 font-mono text-lg font-bold tracking-widest text-black"
      >
        {copied ? "Copiado!" : block.code}
      </button>
      <p className="mt-2 text-sm opacity-80">{block.description}</p>
    </div>
  );
}

function Plans({ block }: { block: Extract<Block, { type: "plans" }> }) {
  const plans = block.items
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([name]) => name);
  return (
    <section className="flex flex-col gap-3">
      {block.title && <h2 className="px-1 text-xl font-extrabold">{block.title}</h2>}
      {plans.map(([name, price, details]) => (
        <div key={name} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
          <p className="font-bold">{name}</p>
          {price && <p className="mt-1 text-2xl font-black text-[var(--primary)]">{price}</p>}
          {details && <p className="mt-1 text-sm opacity-80">{details}</p>}
        </div>
      ))}
      {block.footnote && <p className="whitespace-pre-line px-1 text-xs opacity-70">{block.footnote}</p>}
    </section>
  );
}

export function BlocksRenderer({ blocks, onClick }: { blocks: Block[]; onClick?: (blockId: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => {
        switch (block.type) {
          case "hero":
            return (
              <section key={block.id} className="overflow-hidden rounded-3xl bg-white/10 backdrop-blur">
                {block.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.imageUrl} alt="" className="h-48 w-full object-cover" />
                )}
                <div className="p-5">
                  <h2 className="text-2xl font-extrabold leading-tight">{block.title}</h2>
                  <p className="mt-1 opacity-80">{block.subtitle}</p>
                </div>
              </section>
            );
          case "text":
            return (
              <p key={block.id} className="whitespace-pre-line px-1 leading-relaxed opacity-90">
                {block.text}
              </p>
            );
          case "banner": {
            const content = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {block.imageUrl && <img src={block.imageUrl} alt={block.caption} className="w-full object-cover" />}
                {block.caption && <p className="px-4 py-3 text-sm font-semibold">{block.caption}</p>}
              </>
            );
            return block.linkUrl ? (
              <a
                key={block.id}
                href={block.linkUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => onClick?.(block.id)}
                className="block overflow-hidden rounded-3xl bg-white/10"
              >
                {content}
              </a>
            ) : (
              <div key={block.id} className="overflow-hidden rounded-3xl bg-white/10">
                {content}
              </div>
            );
          }
          case "video":
            return block.videoUrl ? <Video key={block.id} url={block.videoUrl} className="rounded-3xl" /> : null;
          case "carousel":
            return <Carousel key={block.id} images={block.images.split("\n").map((s) => s.trim()).filter(Boolean)} />;
          case "coupon":
            return <Coupon key={block.id} block={block} />;
          case "plans":
            return <Plans key={block.id} block={block} />;
          case "whatsapp":
            return block.phone ? (
              <a
                key={block.id}
                href={`https://wa.me/${block.phone.replace(/\D/g, "")}?text=${encodeURIComponent(block.message)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => onClick?.(block.id)}
                className="flex items-center justify-center gap-3 rounded-3xl bg-[#25d366] px-5 py-4 text-lg font-bold text-white shadow-lg"
              >
                <span className="text-2xl">💬</span> {block.label}
              </a>
            ) : null;
          case "instagram":
            return (
              <a
                key={block.id}
                href={`https://instagram.com/${block.handle.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => onClick?.(block.id)}
                className="flex items-center gap-4 rounded-3xl bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-5 text-white"
              >
                <span className="grid size-12 place-items-center rounded-2xl border-2 border-white text-2xl">◎</span>
                <span>
                  <span className="block text-lg font-bold">@{block.handle.replace("@", "")}</span>
                  <span className="block text-sm opacity-90">{block.text}</span>
                </span>
              </a>
            );
        }
      })}
    </div>
  );
}

export { Video };
