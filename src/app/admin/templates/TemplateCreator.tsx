"use client";

import { useState, useTransition } from "react";
import { Card, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import type { NewTemplate, TemplateButton, TemplateComponent } from "@/lib/meta-templates";
import { createWhatsappTemplate } from "../actions";

const LANGUAGES = [
  { code: "pt_BR", label: "Português (BR)" },
  { code: "en_US", label: "Inglês (EUA)" },
  { code: "es", label: "Espanhol" },
];
const MAX_BUTTONS = 3;

const sanitizeName = (v: string) =>
  v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
const variables = (text: string) => [...new Set(text.match(/\{\{\d+\}\}/g) ?? [])];
const fill = (text: string, examples: string[]) => text.replace(/\{\{(\d+)\}\}/g, (m, n) => examples[Number(n) - 1] || m);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
      {label}
      {children}
      {hint && <span className="font-normal text-ink-400">{hint}</span>}
    </label>
  );
}

function Preview({ header, body, footer, buttons }: { header?: string; body: string; footer?: string; buttons: string[] }) {
  return (
    <div className="self-start rounded-2xl bg-[#e5ddd5] p-4">
      <div className="max-w-[300px] rounded-xl rounded-tl-none bg-snow p-3 text-sm text-[#111b21] shadow">
        {header && <p className="mb-1 font-bold">{header}</p>}
        <p className="whitespace-pre-line">{body || "Texto da mensagem..."}</p>
        {footer && <p className="mt-1 text-xs text-ink-400">{footer}</p>}
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="mt-1 max-w-[300px] rounded-xl bg-snow py-2 text-center text-sm font-medium text-[#0b84c4] shadow">
          {b || "Botão"}
        </div>
      ))}
    </div>
  );
}

function useSubmit() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const submit = (template: NewTemplate) =>
    start(async () => {
      const res = await createWhatsappTemplate(template);
      setResult(res.error ? { error: res.error } : { ok: true });
    });
  return { pending, result, submit };
}

function Feedback({ result }: { result: { ok?: boolean; error?: string } | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="text-sm text-emerald-300">✅ Enviado para a Meta. A aprovação costuma levar alguns minutos; o status aparece na lista ao lado.</p>
  ) : (
    <p className="text-sm text-rose-300">❌ {result.error}</p>
  );
}

function AuthenticationForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [language, setLanguage] = useState("pt_BR");
  const [expiration, setExpiration] = useState(10);
  const [security, setSecurity] = useState(true);
  const [buttonText, setButtonText] = useState("Copiar código");
  const { pending, result, submit } = useSubmit();

  const components: TemplateComponent[] = [
    { type: "BODY", add_security_recommendation: security },
    ...(expiration ? [{ type: "FOOTER" as const, code_expiration_minutes: expiration }] : []),
    { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: buttonText }] },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-300">
          A Meta define o texto dos templates de autenticação. Você escolhe o aviso de segurança, a validade e o botão de copiar.
        </p>
        <Field label="Nome" hint="Precisa ser igual a WHATSAPP_OTP_TEMPLATE no .env do servidor.">
          <input className={inputClass} value={name} onChange={(e) => setName(sanitizeName(e.target.value))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Idioma">
            <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Validade do código (min)">
            <input type="number" min={1} max={90} className={inputClass} value={expiration} onChange={(e) => setExpiration(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Texto do botão">
          <input className={inputClass} maxLength={25} value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={security} onChange={(e) => setSecurity(e.target.checked)} /> Incluir aviso &quot;não compartilhe este código&quot;
        </label>
        <button className={`${buttonClass} self-start`} disabled={pending || !name}
          onClick={() => submit({ name, language, category: "AUTHENTICATION", components })}>
          {pending ? "Enviando..." : "Criar template na Meta"}
        </button>
        <Feedback result={result} />
      </div>
      <Preview
        body={`*123456* é o seu código de verificação.${security ? " Para sua segurança, não o compartilhe." : ""}`}
        footer={expiration ? `Este código expira em ${expiration} minutos.` : undefined}
        buttons={[buttonText]}
      />
    </div>
  );
}

type ButtonDraft = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value: string };

function MessageForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [language, setLanguage] = useState("pt_BR");
  const [header, setHeader] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  const [body, setBody] = useState("Olá {{1}}! ");
  const [examples, setExamples] = useState<string[]>(["Maria"]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const { pending, result, submit } = useSubmit();

  const bodyVars = variables(body);
  const headerHasVar = /\{\{1\}\}/.test(header);
  const setButton = (i: number, patch: Partial<ButtonDraft>) => setButtons(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const build = (): NewTemplate => {
    const components: TemplateComponent[] = [];
    if (header) {
      components.push({ type: "HEADER", format: "TEXT", text: header, ...(headerHasVar && { example: { header_text: [headerExample] } }) });
    }
    components.push({ type: "BODY", text: body, ...(bodyVars.length && { example: { body_text: [examples.slice(0, bodyVars.length)] } }) });
    if (footer) components.push({ type: "FOOTER", text: footer });
    if (buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((b): TemplateButton =>
          b.type === "URL" ? { type: "URL", text: b.text, url: b.value }
            : b.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.value }
              : { type: "QUICK_REPLY", text: b.text }),
      });
    }
    return { name, category, language, components };
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nome" hint="minúsculas, números e _">
            <input className={inputClass} value={name} placeholder="verao_conectado_promo" onChange={(e) => setName(sanitizeName(e.target.value))} />
          </Field>
          <Field label="Categoria">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              <option value="MARKETING">Marketing (campanhas)</option>
              <option value="UTILITY">Utilidade (avisos)</option>
            </select>
          </Field>
          <Field label="Idioma">
            <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Título (opcional)" hint="Até 60 caracteres. Pode ter {{1}}.">
            <input className={inputClass} maxLength={60} value={header} onChange={(e) => setHeader(e.target.value)} />
          </Field>
          {headerHasVar && (
            <Field label="Exemplo para o {{1}} do título">
              <input className={inputClass} value={headerExample} onChange={(e) => setHeaderExample(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Mensagem" hint="Use {{1}}, {{2}}... para trocar por nome, local etc. na hora do envio.">
          <textarea className={inputClass} rows={6} maxLength={1024} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <button type="button" className={`${ghostButtonClass} self-start`} onClick={() => setBody(`${body}{{${bodyVars.length + 1}}}`)}>
          + Inserir variável
        </button>
        {bodyVars.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {bodyVars.map((v, i) => (
              <Field key={v} label={`Exemplo para ${v}`}>
                <input className={inputClass} value={examples[i] ?? ""}
                  onChange={(e) => setExamples(Object.assign([...examples], { [i]: e.target.value }))} />
              </Field>
            ))}
          </div>
        )}
        <Field label="Rodapé (opcional)" hint="Até 60 caracteres. Ex.: Responda SAIR para não receber mais.">
          <input className={inputClass} maxLength={60} value={footer} onChange={(e) => setFooter(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-ink-300">Botões (opcional)</span>
          {buttons.map((b, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[150px_1fr_1fr_auto]">
              <select className={inputClass} value={b.type} onChange={(e) => setButton(i, { type: e.target.value as ButtonDraft["type"] })}>
                <option value="QUICK_REPLY">Resposta rápida</option>
                <option value="URL">Abrir site</option>
                <option value="PHONE_NUMBER">Ligar</option>
              </select>
              <input className={inputClass} maxLength={25} placeholder="Texto do botão" value={b.text} onChange={(e) => setButton(i, { text: e.target.value })} />
              {b.type === "QUICK_REPLY" ? <span /> : (
                <input className={inputClass} placeholder={b.type === "URL" ? "https://..." : "+5522999999999"} value={b.value}
                  onChange={(e) => setButton(i, { value: e.target.value })} />
              )}
              <button type="button" className="px-2 text-sm text-rose-300" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
          {buttons.length < MAX_BUTTONS && (
            <button type="button" className={`${ghostButtonClass} self-start`}
              onClick={() => setButtons([...buttons, { type: "QUICK_REPLY", text: "", value: "" }])}>
              + Adicionar botão
            </button>
          )}
        </div>

        <button className={`${buttonClass} self-start`} disabled={pending || !name || !body.trim()} onClick={() => submit(build())}>
          {pending ? "Enviando..." : "Criar template na Meta"}
        </button>
        <Feedback result={result} />
      </div>
      <Preview
        header={header ? fill(header, [headerExample]) : undefined}
        body={fill(body, examples)}
        footer={footer || undefined}
        buttons={buttons.map((b) => b.text)}
      />
    </div>
  );
}

export function TemplateCreator({ otpTemplate, otpStatus }: { otpTemplate: string; otpStatus: string | null }) {
  const [tab, setTab] = useState<"auth" | "message">(otpStatus ? "message" : "auth");
  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${active ? "bg-brand text-snow shadow-glow" : "bg-white text-ink-300 hover:bg-white/5"}`;

  return (
    <Card>
      {!otpStatus && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          O template do código do Wi-Fi (<b>{otpTemplate}</b>) ainda não existe na Meta. Crie na aba &quot;Código do Wi-Fi&quot;.
        </p>
      )}
      <div className="mb-5 flex gap-2">
        <button className={tabClass(tab === "auth")} onClick={() => setTab("auth")}>Código do Wi-Fi (autenticação)</button>
        <button className={tabClass(tab === "message")} onClick={() => setTab("message")}>Mensagem / campanha</button>
      </div>
      {tab === "auth" ? <AuthenticationForm defaultName={otpTemplate} /> : <MessageForm />}
    </Card>
  );
}
