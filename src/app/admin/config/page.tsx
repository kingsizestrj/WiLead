import { Card, PageHeader, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { PROMO_LABEL } from "@/lib/chatwoot";
import { getSettings } from "@/lib/db";
import { otpTemplate } from "@/lib/whatsapp";
import { changePassword, clearMetaCredentials, importMetaFromChatwoot, saveMeta, saveSettings, saveUnifi } from "../actions";
import { TestMetaButton } from "./TestMetaButton";
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
  const metaConfigured = !!(settings.metaToken && settings.metaPhoneNumberId && settings.metaWabaId);
  const template = otpTemplate({ ...settings, otpTemplate: null, otpTemplateLanguage: null });
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
          </dl>
          <p className="mt-4 text-sm text-ink-300">
            Cada cliente vira contato no Chatwoot com as etiquetas <b>wifi</b>, <b>wifi-&lt;local&gt;</b> e, se aceitou, <b>{PROMO_LABEL}</b>.
            Use essas etiquetas como público das campanhas de WhatsApp no Chatwoot.
          </p>
        </Card>
        <Card title="WhatsApp (API da Meta)">
          <form action={saveMeta} className="flex flex-col gap-3">
            <p className="text-sm text-ink-300">
              {metaConfigured
                ? "✅ O código do Wi-Fi sai direto pela Meta com as credenciais abaixo."
                : "O código do Wi-Fi sai direto pela Meta com as credenciais da caixa de WhatsApp do Chatwoot. Preencha abaixo para usar outras."}
            </p>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
              Token de acesso
              <input name="metaToken" type="password" autoComplete="off" className={inputClass}
                placeholder={settings.metaToken ? `(manter atual, termina em ${settings.metaToken.slice(-4)})` : "EAAG..."} />
              <span className="text-xs font-normal text-ink-400">
                Token permanente de um usuário do sistema (Meta Business → Usuários do sistema) com as permissões whatsapp_business_messaging e whatsapp_business_management.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                ID do número de telefone
                <input name="metaPhoneNumberId" inputMode="numeric" defaultValue={settings.metaPhoneNumberId ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                ID da conta do WhatsApp Business (WABA)
                <input name="metaWabaId" inputMode="numeric" defaultValue={settings.metaWabaId ?? ""} className={inputClass} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Template do código
                <input name="otpTemplate" defaultValue={settings.otpTemplate ?? ""} placeholder={template.name} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
                Idioma
                <input name="otpTemplateLanguage" defaultValue={settings.otpTemplateLanguage ?? ""} placeholder={template.language} className={inputClass} />
              </label>
            </div>
            <p className="text-xs text-ink-400">
              Template da categoria Autenticação com o botão &quot;Copiar código&quot; (crie em Templates WhatsApp com um clique). Se a Meta recusar o envio, o código sai pela caixa do Chatwoot.
              O teste usa o que está salvo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button className={buttonClass}>Salvar</button>
              <TestMetaButton />
              {metaConfigured ? (
                <button formAction={clearMetaCredentials} className={ghostButtonClass}>Voltar a usar as do Chatwoot</button>
              ) : (
                chatwootReady && <button formAction={importMetaFromChatwoot} className={ghostButtonClass}>Copiar do Chatwoot</button>
              )}
            </div>
          </form>
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
