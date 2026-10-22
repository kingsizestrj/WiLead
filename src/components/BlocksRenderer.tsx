"use client";

import { Check, Copy, MessageCircle, Ticket, Zap } from "lucide-react";
import { useState } from "react";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
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
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-snow/40 bg-snow/10 p-5 text-center backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--primary)] opacity-40 blur-2xl" />
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] opacity-80"><Ticket className="h-4 w-4" /> Cupom exclusivo Wi-Fi</p>
      <p className="mt-1 text-3xl font-black">{block.title}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(block.code);
          setCopied(true);
        }}
        className="relative mt-3 inline-flex items-center gap-2 rounded-xl bg-snow px-5 py-2 font-mono text-lg font-bold tracking-widest text-black transition active:scale-[.98]"
      >
        {copied ? <><Check className="h-5 w-5" /> Copiado!</> : <><Copy className="h-5 w-5" /> {block.code}</>}
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
    <section className="overflow-hidden rounded-3xl border border-snow/15 bg-snow/10 backdrop-blur">
      {block.title && (
        <h2 className="flex items-center gap-2 border-b border-snow/10 bg-[var(--primary)]/20 px-5 py-3 text-lg font-extrabold">
          <Zap className="h-5 w-5 text-[var(--primary)]" /> {block.title}
        </h2>
      )}
      <ul className="divide-y divide-snow/10">
        {plans.map(([name, price, details]) => (
          <li key={name} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <span className="font-semibold">{name}</span>
            <span className="text-right">
              {price && <span className="block text-lg font-extrabold leading-tight text-[var(--primary)]">{price}</span>}
              {details && <span className="block text-xs opacity-75">{details}</span>}
            </span>
          </li>
        ))}
      </ul>
      {block.footnote && <p className="whitespace-pre-line border-t border-snow/10 px-5 py-3 text-xs opacity-75">{block.footnote}</p>}
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
              <section key={block.id} className="overflow-hidden rounded-3xl bg-snow/10 backdrop-blur">
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
                className="block overflow-hidden rounded-3xl bg-snow/10"
              >
                {content}
              </a>
            ) : (
              <div key={block.id} className="overflow-hidden rounded-3xl bg-snow/10">
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
                className="flex items-center justify-center gap-3 rounded-3xl bg-[#25d366] px-5 py-4 text-lg font-bold text-snow shadow-[0_14px_40px_-12px_#25d366] ring-1 ring-snow/20 transition active:scale-[.98]"
              >
                <MessageCircle className="h-6 w-6" /> {block.label}
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
                className="flex items-center gap-4 rounded-3xl bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-5 text-snow shadow-[0_14px_40px_-12px_#d62976] transition active:scale-[.98]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-snow/20 ring-1 ring-snow/40"><InstagramIcon /></span>
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
