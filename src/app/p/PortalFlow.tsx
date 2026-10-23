"use client";

import { MessageCircle, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { BlocksRenderer, Video } from "@/components/BlocksRenderer";
import type { Block } from "@/lib/blocks";
import type { HotspotParams } from "@/lib/portal";

type Props = {
  hotspot: HotspotParams;
  portal: { id: string; blocks: Block[]; adVideoUrl: string | null; adSeconds: number; termsText: string };
  locationId: string;
  known: { name: string; phone: string } | null;
  // Code already sent to this device and still valid (client came back from WhatsApp)
  pending: { otpId: string; phone: string } | null;
  routerError: string | null;
};

type Grant = { username: string; password: string; minutes: number };
type Step = "confirm" | "register" | "code" | "ad" | "connecting";

const input =
  "w-full rounded-2xl border border-snow/20 bg-snow/10 px-4 py-3.5 text-base placeholder:text-current/50 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/25";
const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-4 text-base font-bold text-snow shadow-[0_14px_40px_-12px_var(--primary)] ring-1 ring-snow/20 transition hover:brightness-110 active:scale-[.98] disabled:opacity-60";

function formatPhoneInput(value: string) {
  let d = value.replace(/\D/g, "").replace(/^0+/, "");
  // Autofill and pasted numbers bring the country code (+55); the field takes DDD + number only
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro inesperado");
  return data;
}

export function PortalFlow({ hotspot, portal, locationId, known, pending, routerError }: Props) {
  const [step, setStep] = useState<Step>(pending ? "code" : known ? "confirm" : "register");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(routerError);
  const [form, setForm] = useState({ name: "", phone: "", email: "", optIn: true });
  const [otpId, setOtpId] = useState(pending?.otpId ?? "");
  const [whatsappMinutes, setWhatsappMinutes] = useState(0);
  const [code, setCode] = useState("");
  const [grant, setGrant] = useState<Grant | null>(null);
  const [countdown, setCountdown] = useState(portal.adSeconds);

  const track = (type: "AD_VIDEO_COMPLETED" | "BLOCK_CLICK", blockId?: string) =>
    navigator.sendBeacon?.(
      "/api/portal/event",
      new Blob([JSON.stringify({ type, portalId: portal.id, locationId, blockId, mac: hotspot.mac })], { type: "application/json" }),
    );

  // Logs the device into the MikroTik hotspot; after login the router sends it to our success page.
  const connect = (g: Grant) => {
    setStep("connecting");
    const dst = `${window.location.origin}/p/ok?portal=${portal.id}&location=${locationId}&mac=${encodeURIComponent(hotspot.mac)}&dst=${encodeURIComponent(hotspot.dst)}`;
    const url = new URL(hotspot.loginUrl);
    url.searchParams.set("username", g.username);
    url.searchParams.set("password", g.password);
    url.searchParams.set("dst", dst);
    window.location.href = url.toString();
  };

  const onGranted = (g: Grant) => {
    setGrant(g);
    if (portal.adVideoUrl && portal.adSeconds > 0) setStep("ad");
    else connect(g);
  };

  useEffect(() => {
    if (step !== "ad" || !grant) return;
    if (countdown <= 0) {
      track("AD_VIDEO_COMPLETED");
      connect(grant);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countdown, grant]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmReturning = () => run(async () => onGranted(await post<Grant>("/api/portal/returning", hotspot)));

  const sendCode = () =>
    run(async () => {
      const res = await post<{ otpId: string; whatsappMinutes: number }>("/api/portal/otp/send", {
        ...form,
        mac: hotspot.mac,
        ip: hotspot.ip,
        server: hotspot.server,
        iface: hotspot.iface,
      });
      setOtpId(res.otpId);
      setWhatsappMinutes(res.whatsappMinutes);
      setCode("");
      setStep("code");
    });

  const verifyCode = () => run(async () => onGranted(await post<Grant>("/api/portal/otp/verify", { ...hotspot, otpId, code })));

  return (
    <>
      <div className="animate-fade-up rounded-[2rem] border border-snow/15 bg-black/25 p-6 shadow-2xl backdrop-blur-2xl">
        {step === "confirm" && known && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm uppercase tracking-[0.2em] opacity-70">Que bom te ver de novo</p>
            <p className="text-2xl font-bold">
              Você é {known.name}?
              <span className="mt-1 block text-base font-normal opacity-80">WhatsApp {known.phone}</span>
            </p>
            <button className={primaryButton} disabled={busy} onClick={confirmReturning}>
              {busy ? "Conectando..." : <><Wifi className="h-5 w-5" /> Sim, sou eu</>}
            </button>
            <button className="py-2 text-sm underline opacity-80" onClick={() => setStep("register")}>
              Não sou eu
            </button>
          </div>
        )}

        {step === "register" && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
          >
            <p className="mb-1 text-center opacity-90">Cadastre-se e receba o código de acesso no seu WhatsApp.</p>
            <input className={input} required minLength={2} placeholder="Seu nome" autoComplete="name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} required inputMode="tel" placeholder="WhatsApp (DDD + número)" autoComplete="tel"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })} />
            <input className={input} type="email" placeholder="E-mail (opcional)" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label className="flex items-start gap-3 text-sm opacity-90">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={form.optIn}
                onChange={(e) => setForm({ ...form, optIn: e.target.checked })} />
              Quero receber novidades e promoções pelo WhatsApp
            </label>
            <button className={primaryButton} disabled={busy}>
              {busy ? "Enviando..." : <><MessageCircle className="h-5 w-5" /> Receber código no WhatsApp</>}
            </button>
            <p className="text-center text-xs opacity-60">{portal.termsText}</p>
          </form>
        )}

        {step === "code" && (
          <form
            className="flex flex-col gap-4 text-center"
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode();
            }}
          >
            <p className="opacity-90">
              Enviamos um código de 6 dígitos para o WhatsApp <b>{form.phone || pending?.phone}</b>
            </p>
            {whatsappMinutes > 0 && (
              <p className="rounded-xl bg-snow/10 px-4 py-2 text-sm">
                Sem internet no celular? O WhatsApp já está liberado neste Wi-Fi por {whatsappMinutes} minutos: abra, copie o código e volte aqui.
              </p>
            )}
            <input className={`${input} text-center font-mono text-3xl tracking-[0.5em]`} required inputMode="numeric"
              autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className={primaryButton} disabled={busy || code.length !== 6}>
              {busy ? "Verificando..." : <><Wifi className="h-5 w-5" /> Liberar internet</>}
            </button>
            <div className="flex justify-between text-sm opacity-80">
              <button type="button" className="underline" onClick={() => setStep("register")}>Corrigir número</button>
              {/* A resumed code has no form data to resend; "Corrigir número" asks again */}
              {form.phone && (
                <button type="button" className="underline" disabled={busy} onClick={sendCode}>Reenviar código</button>
              )}
            </div>
          </form>
        )}

        {step === "ad" && portal.adVideoUrl && (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm opacity-80">Um recado dos nossos parceiros</p>
            <Video url={portal.adVideoUrl} className="rounded-2xl" />
            <p className="font-semibold">Sua internet será liberada em {countdown}s</p>
          </div>
        )}

        {step === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="size-10 animate-spin rounded-full border-4 border-snow/30 border-t-[var(--primary)]" />
            <p className="font-semibold">Conectando você...</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-rose-500/25 px-4 py-3 text-center text-sm">{error}</p>}
      </div>

      <BlocksRenderer blocks={portal.blocks} onClick={(id) => track("BLOCK_CLICK", id)} />
    </>
  );
}
