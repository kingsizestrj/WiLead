import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Card, PageHeader, ghostButtonClass } from "@/components/admin/ui";
import { listTemplates, type MetaTemplate } from "@/lib/meta-templates";
import { deleteWhatsappTemplate } from "../actions";
import { TemplateCreator } from "./TemplateCreator";

const STATUS: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Em análise", className: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "Rejeitado", className: "bg-red-100 text-red-700" },
  PAUSED: { label: "Pausado", className: "bg-slate-200 text-slate-700" },
  DISABLED: { label: "Desativado", className: "bg-slate-200 text-slate-700" },
};

const CATEGORY: Record<string, string> = { AUTHENTICATION: "Autenticação", MARKETING: "Marketing", UTILITY: "Utilidade" };

function bodyText(t: MetaTemplate) {
  const body = t.components.find((c) => c.type === "BODY");
  return body?.text ?? (t.category === "AUTHENTICATION" ? "{{1}} é o seu código de verificação." : "");
}

export default async function TemplatesPage() {
  const otpTemplate = process.env.WHATSAPP_OTP_TEMPLATE ?? "";
  let templates: MetaTemplate[] = [];
  let error: string | null = null;
  try {
    templates = await listTemplates();
  } catch (e) {
    error = (e as Error).message;
  }
  const otp = templates.find((t) => t.name === otpTemplate);

  return (
    <>
      <PageHeader
        title="Templates WhatsApp"
        subtitle="Criados direto na Meta, com as credenciais da caixa de WhatsApp do Chatwoot. Depois de criar, o Chatwoot é sincronizado automaticamente."
      />

      {error ? (
        <Card>
          <p className="text-sm text-red-600">Não foi possível falar com a Meta: {error}</p>
          <p className="mt-2 text-sm text-slate-500">Confira as variáveis do Chatwoot em Configurações (o token precisa ser de um administrador).</p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-4">
            <TemplateCreator otpTemplate={otpTemplate} otpStatus={otp?.status ?? null} />
          </div>
          <Card title={`Templates na Meta (${templates.length})`} className="xl:self-start">
            <ul className="flex flex-col divide-y divide-slate-100">
              {templates.map((t) => {
                const status = STATUS[t.status] ?? { label: t.status, className: "bg-slate-100" };
                return (
                  <li key={t.id} className="flex flex-col gap-1 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{t.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      <span className="text-xs text-slate-400">{CATEGORY[t.category] ?? t.category} · {t.language}</span>
                      {t.name === otpTemplate && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">código do Wi-Fi</span>}
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">{bodyText(t)}</p>
                    {t.rejected_reason && t.rejected_reason !== "NONE" && <p className="text-xs text-red-600">Motivo: {t.rejected_reason}</p>}
                    <form action={deleteWhatsappTemplate.bind(null, t.name)} className="self-end">
                      <ConfirmButton
                        message={`Excluir o template ${t.name} na Meta? O mesmo nome só pode ser reutilizado depois de 4 semanas.`}
                        className={`${ghostButtonClass} !px-2 !py-1 text-xs text-red-600`}
                      >
                        Excluir
                      </ConfirmButton>
                    </form>
                  </li>
                );
              })}
              {!templates.length && <p className="text-sm text-slate-400">Nenhum template ainda.</p>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
