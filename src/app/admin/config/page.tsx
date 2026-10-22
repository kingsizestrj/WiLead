import { Card, PageHeader, buttonClass, inputClass } from "@/components/admin/ui";
import { getSettings } from "@/lib/db";
import { saveSettings } from "../actions";

export default async function SettingsPage() {
  const settings = await getSettings();
  const whatsappReady = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Acesso">
          <form action={saveSettings} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Tempo de internet por liberação (minutos)
              <input name="sessionMinutes" type="number" min={1} defaultValue={settings.sessionMinutes} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Validade do código do WhatsApp (minutos)
              <input name="otpTtlMinutes" type="number" min={1} defaultValue={settings.otpTtlMinutes} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Máximo de códigos por telefone/aparelho por hora
              <input name="otpMaxPerHour" type="number" min={1} defaultValue={settings.otpMaxPerHour} className={inputClass} />
            </label>
            <button className={`${buttonClass} self-start`}>Salvar</button>
          </form>
        </Card>
        <Card title="WhatsApp Cloud API (Meta)">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Status</dt>
            <dd>{process.env.WHATSAPP_DRY_RUN === "true" ? "🧪 Modo teste (código só no log)" : whatsappReady ? "✅ Configurado" : "❌ Faltam variáveis"}</dd>
            <dt className="text-slate-500">Número (ID)</dt>
            <dd className="font-mono">{process.env.WHATSAPP_PHONE_NUMBER_ID ?? "—"}</dd>
            <dt className="text-slate-500">Template</dt>
            <dd className="font-mono">{process.env.WHATSAPP_OTP_TEMPLATE ?? "—"} ({process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR"})</dd>
          </dl>
          <p className="mt-4 text-xs text-slate-400">As credenciais ficam nas variáveis de ambiente do servidor (.env).</p>
        </Card>
      </div>
    </>
  );
}
