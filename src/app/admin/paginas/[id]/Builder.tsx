"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BlocksRenderer } from "@/components/BlocksRenderer";
import { PortalShell } from "@/components/PortalShell";
import { Card, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { BLOCK_LABELS, newBlock, type Block, type BlockType, type Theme } from "@/lib/blocks";
import { savePortal, type PortalInput } from "../../actions";

type FieldKind = "text" | "textarea" | "image" | "video" | "images";
const FIELDS: Record<BlockType, { key: string; label: string; kind: FieldKind }[]> = {
  hero: [
    { key: "title", label: "Título", kind: "text" },
    { key: "subtitle", label: "Subtítulo", kind: "text" },
    { key: "imageUrl", label: "Imagem", kind: "image" },
  ],
  text: [{ key: "text", label: "Texto", kind: "textarea" }],
  banner: [
    { key: "imageUrl", label: "Imagem do anúncio", kind: "image" },
    { key: "caption", label: "Legenda", kind: "text" },
    { key: "linkUrl", label: "Link ao clicar", kind: "text" },
  ],
  video: [{ key: "videoUrl", label: "Vídeo (MP4 enviado ou link do YouTube)", kind: "video" }],
  carousel: [{ key: "images", label: "Imagens (uma URL por linha)", kind: "images" }],
  coupon: [
    { key: "title", label: "Oferta", kind: "text" },
    { key: "code", label: "Código", kind: "text" },
    { key: "description", label: "Descrição", kind: "text" },
  ],
  instagram: [
    { key: "handle", label: "@ do Instagram", kind: "text" },
    { key: "text", label: "Chamada", kind: "text" },
  ],
  plans: [
    { key: "title", label: "Título", kind: "text" },
    { key: "items", label: "Um por linha: Nome | Preço | Detalhes", kind: "textarea" },
    { key: "footnote", label: "Observações", kind: "textarea" },
  ],
  whatsapp: [
    { key: "phone", label: "Número do WhatsApp (com DDD)", kind: "text" },
    { key: "label", label: "Texto do botão", kind: "text" },
    { key: "message", label: "Mensagem que já vem escrita", kind: "textarea" },
  ],
};

async function upload(file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.url as string;
}

function MediaInput({ value, onChange, accept }: { value: string; onChange: (v: string) => void; accept: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <input className={`${inputClass} min-w-0 flex-1`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL ou envie um arquivo" />
      <label className={`${ghostButtonClass} cursor-pointer whitespace-nowrap`}>
        {busy ? "Enviando..." : "Enviar"}
        <input type="file" accept={accept} className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            onChange(await upload(file));
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setBusy(false);
          }
        }} />
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}

export function Builder({ id, initial }: { id: string; initial: PortalInput }) {
  const [data, setData] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();

  const update = (patch: Partial<PortalInput>) => {
    setData((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  const setTheme = (patch: Partial<Theme>) => update({ theme: { ...data.theme, ...patch } });
  const setBlock = (index: number, patch: Record<string, string>) =>
    update({ blocks: data.blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as Block) : b)) });
  const moveBlock = (index: number, delta: number) => {
    const blocks = [...data.blocks];
    const [b] = blocks.splice(index, 1);
    blocks.splice(index + delta, 0, b);
    update({ blocks });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/paginas" className="text-sm text-slate-500 hover:underline">← Voltar</Link>
            <input className="rounded-lg bg-transparent px-2 py-1 text-2xl font-bold outline-none hover:bg-white focus:bg-white"
              value={data.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <button className={buttonClass} disabled={pending}
            onClick={() => start(async () => { await savePortal(id, data); setSaved(true); })}>
            {pending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar alterações"}
          </button>
        </div>

        <Card title="Visual">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título de boas-vindas">
              <input className={inputClass} value={data.welcomeTitle} onChange={(e) => update({ welcomeTitle: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cor principal">
                <input type="color" className="h-10 w-full rounded-lg" value={data.theme.primaryColor} onChange={(e) => setTheme({ primaryColor: e.target.value })} />
              </Field>
              <Field label="Fundo">
                <input type="color" className="h-10 w-full rounded-lg" value={data.theme.backgroundColor} onChange={(e) => setTheme({ backgroundColor: e.target.value })} />
              </Field>
              <Field label="Texto">
                <input type="color" className="h-10 w-full rounded-lg" value={data.theme.textColor} onChange={(e) => setTheme({ textColor: e.target.value })} />
              </Field>
            </div>
            <Field label="Logo">
              <MediaInput accept="image/*" value={data.theme.logoUrl} onChange={(v) => setTheme({ logoUrl: v })} />
            </Field>
            <Field label="Imagem de fundo">
              <MediaInput accept="image/*" value={data.theme.backgroundImage} onChange={(v) => setTheme({ backgroundImage: v })} />
            </Field>
          </div>
        </Card>

        <Card title="Vídeo obrigatório antes de liberar (patrocinador)">
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <Field label="Vídeo">
              <MediaInput accept="video/mp4,video/webm" value={data.adVideoUrl} onChange={(v) => update({ adVideoUrl: v })} />
            </Field>
            <Field label="Segundos de exibição">
              <input type="number" min={0} className={inputClass} value={data.adSeconds} onChange={(e) => update({ adSeconds: Number(e.target.value) })} />
            </Field>
          </div>
        </Card>

        <Card title="Após conectar">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Instagram da empresa (@)">
              <input className={inputClass} value={data.instagram} onChange={(e) => update({ instagram: e.target.value })} placeholder="@voltec" />
            </Field>
            <Field label="Redirecionar para (opcional)">
              <input className={inputClass} value={data.redirectUrl} onChange={(e) => update({ redirectUrl: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Texto de termos / LGPD">
              <textarea className={inputClass} rows={2} value={data.termsText} onChange={(e) => update({ termsText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Blocos de conteúdo">
          <div className="flex flex-col gap-3">
            {data.blocks.map((block, index) => (
              <div key={block.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{BLOCK_LABELS[block.type]}</span>
                  <div className="flex gap-1 text-sm">
                    <button disabled={index === 0} onClick={() => moveBlock(index, -1)} className="rounded px-2 hover:bg-slate-100 disabled:opacity-30">↑</button>
                    <button disabled={index === data.blocks.length - 1} onClick={() => moveBlock(index, 1)} className="rounded px-2 hover:bg-slate-100 disabled:opacity-30">↓</button>
                    <button onClick={() => update({ blocks: data.blocks.filter((_, i) => i !== index) })} className="rounded px-2 text-red-600 hover:bg-red-50">Remover</button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {FIELDS[block.type].map((f) => {
                    const value = (block as Record<string, string>)[f.key];
                    const onChange = (v: string) => setBlock(index, { [f.key]: v });
                    return (
                      <Field key={f.key} label={f.label}>
                        {f.kind === "text" && <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />}
                        {(f.kind === "textarea" || f.kind === "images") && (
                          <textarea className={inputClass} rows={5} value={value} onChange={(e) => onChange(e.target.value)} />
                        )}
                        {f.kind === "image" && <MediaInput accept="image/*" value={value} onChange={onChange} />}
                        {f.kind === "video" && <MediaInput accept="video/mp4,video/webm" value={value} onChange={onChange} />}
                        {f.kind === "images" && (
                          <MediaInput accept="image/*" value="" onChange={(url) => onChange([value, url].filter(Boolean).join("\n"))} />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                <button key={type} className={ghostButtonClass} onClick={() => update({ blocks: [...data.blocks, newBlock(type)] })}>
                  + {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Pré-visualização</p>
        <div className="mx-auto h-[780px] w-[380px] overflow-hidden rounded-[3rem] border-[10px] border-slate-900 shadow-2xl">
          <div className="h-full overflow-y-auto">
            <PortalShell theme={data.theme} title={data.welcomeTitle}>
              <div className="flex flex-col gap-3 rounded-[2rem] border border-white/15 bg-black/30 p-6 backdrop-blur-xl">
                <p className="text-center text-sm opacity-90">Cadastre-se e receba o código de acesso no seu WhatsApp.</p>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 opacity-60">Seu nome</div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 opacity-60">WhatsApp</div>
                <div className="rounded-2xl bg-[var(--primary)] px-4 py-4 text-center text-lg font-bold text-white">Receber código no WhatsApp</div>
              </div>
              <BlocksRenderer blocks={data.blocks} />
            </PortalShell>
          </div>
        </div>
      </div>
    </div>
  );
}
