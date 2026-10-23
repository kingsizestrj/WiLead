import { Card, PageHeader, buttonClass, inputClass } from "@/components/admin/ui";
import { PROMO_LABEL } from "@/lib/chatwoot";
import { getSettings } from "@/lib/db";
import { changePassword, saveSettings, saveUnifi } from "../actions";
import { TestUnifiButton } from "./TestUnifiButton";

const PASSWORD_MESSAGES: Record<string, string> = {
  ok: "✅ Senha alterada.",
  "atual-invalida": "❌ Senha atual incorreta.",
  "nova-invalida": "❌ A nova senha precisa ter 8+ caracteres e ser igual à confirmação.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const { senha } = await searchParams;
  const settings = await getSettings();
  const chatwootReady = !!process.env.CHATWOOT_URL && !!process.env.CHATWOOT_API_TOKEN && !!process.env.CHATWOOT_INBOX_ID;
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Acesso">
          <form action={saveSettings} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Tempo de internet por liberação (minutos)
              <input name="sessionMinutes" type="number" min={1} defaultValue={settings.sessionMinutes} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Validade do código do WhatsApp (minutos)
              <input name="otpTtlMinutes" type="number" min={1} defaultValue={settings.otpTtlMinutes} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Máximo de códigos por telefone/aparelho por hora
              <input name="otpMaxPerHour" type="number" min={1} defaultValue={settings.otpMaxPerHour} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Minutos de WhatsApp liberado para quem pede o código (0 = desligado)
              <input name="otpWhatsappMinutes" type="number" min={0} max={15} defaultValue={settings.otpWhatsappMinutes} className={inputClass} />
              <span className="text-xs font-normal text-ink-400">Para quem está sem 4G conseguir ler o código. Precisa do roteador preparado em MikroTik → Gerenciar.</span>
            </label>
            <button className={`${buttonClass} self-start`}>Salvar</button>
          </form>
        </Card>
        <Card title="Chatwoot (WhatsApp)">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-300">Status</dt>
            <dd>{process.env.CHATWOOT_DRY_RUN === "true" ? "🧪 Modo teste (código só no log)" : chatwootReady ? "✅ Configurado" : "❌ Faltam variáveis"}</dd>
            <dt className="text-ink-300">Chatwoot</dt>
            <dd className="font-mono">{process.env.CHATWOOT_URL ?? "—"} · conta {process.env.CHATWOOT_ACCOUNT_ID ?? "—"} · caixa {process.env.CHATWOOT_INBOX_ID ?? "—"}</dd>
            <dt className="text-ink-300">Template do código</dt>
            <dd className="font-mono">{process.env.WHATSAPP_OTP_TEMPLATE ?? "—"} ({process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR"})</dd>
          </dl>
          <p className="mt-4 text-sm text-ink-300">
            Cada cliente vira contato no Chatwoot com as etiquetas <b>wifi</b>, <b>wifi-&lt;local&gt;</b> e, se aceitou, <b>{PROMO_LABEL}</b>.
            Use essas etiquetas como público das campanhas de WhatsApp no Chatwoot.
          </p>
        </Card>
        <Card title="Alterar senha do painel">
          <form action={changePassword} className="flex flex-col gap-3">
            <input name="current" type="password" required placeholder="Senha atual" className={inputClass} />
            <input name="password" type="password" required minLength={8} placeholder="Nova senha (mín. 8 caracteres)" className={inputClass} />
            <input name="confirm" type="password" required minLength={8} placeholder="Repita a nova senha" className={inputClass} />
            {senha && <p className="text-sm">{PASSWORD_MESSAGES[senha]}</p>}
            <button className={`${buttonClass} self-start`}>Alterar senha</button>
          </form>
        </Card>
        <Card title="Controladora UniFi (saúde dos pontos)">
          <form action={saveUnifi} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Endereço da controladora
              <input name="unifiUrl" defaultValue={settings.unifiUrl ?? ""} placeholder="https://10.0.0.5:8443" className={inputClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Usuário
                <input name="unifiUser" defaultValue={settings.unifiUser ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Senha
                <input name="unifiPassword" type="password" placeholder={settings.unifiPassword ? "(manter atual)" : ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Site
                <input name="unifiSite" defaultValue={settings.unifiSite} className={inputClass} />
              </label>
            </div>
            <p className="text-xs text-ink-400">Use um usuário local da controladora só com leitura. Os APs aparecem em Saúde dos pontos para vincular a cada local.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className={buttonClass}>Salvar</button>
              <TestUnifiButton />
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
