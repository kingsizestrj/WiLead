import type { Setting } from "@prisma/client";
import { after } from "next/server";
import { noteOtpSent, sendOtpViaChatwoot, whatsappInboxConfig } from "./chatwoot";
import { getSettings } from "./db";

// WhatsApp Cloud API (Meta). The access code goes straight to Meta: sent through Chatwoot it waited
// in Chatwoot's send queue first. Chatwoot still gets a private note for the client's history.
// https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates

export type MetaCredentials = { token: string; phoneNumberId: string; wabaId: string; source: "wilead" | "chatwoot" };
type OtpTemplate = { name: string; language: string };

const CHATWOOT_CREDENTIALS_TTL_MS = 10 * 60 * 1000;
let chatwootCredentials: { value: Awaited<ReturnType<typeof whatsappInboxConfig>>; at: number } | null = null;

// The credentials saved in Configurações, or else the Chatwoot WhatsApp inbox's (kept in memory so
// a code does not wait for Chatwoot).
export async function metaCredentials(settings?: Setting): Promise<MetaCredentials> {
  const s = settings ?? (await getSettings());
  if (s.metaToken && s.metaPhoneNumberId && s.metaWabaId) {
    return { token: s.metaToken, phoneNumberId: s.metaPhoneNumberId, wabaId: s.metaWabaId, source: "wilead" };
  }
  if (!chatwootCredentials || Date.now() - chatwootCredentials.at > CHATWOOT_CREDENTIALS_TTL_MS) {
    chatwootCredentials = { value: await whatsappInboxConfig(), at: Date.now() };
  }
  return { ...chatwootCredentials.value, source: "chatwoot" };
}

export const otpTemplate = (s: Setting): OtpTemplate => ({
  name: s.otpTemplate || process.env.WHATSAPP_OTP_TEMPLATE || "codigo_wifi",
  language: s.otpTemplateLanguage || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR",
});

// Graph API call; the path starts after the version (e.g. "/<phone number id>/messages").
export async function metaApi<T>(method: string, path: string, body?: unknown, credentials?: MetaCredentials): Promise<T> {
  const c = credentials ?? (await metaCredentials());
  const version = process.env.META_GRAPH_VERSION ?? "v23.0";
  const base = process.env.META_GRAPH_URL ?? "https://graph.facebook.com";
  const res = await fetch(`${base}/${version}${path}`, {
    method,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) {
    // A token changed on the Chatwoot inbox makes the cached one fail: read it again next time
    if (res.status === 401 && c.source === "chatwoot") chatwootCredentials = null;
    throw new Error(data.error?.error_user_msg ?? data.error?.message ?? `Meta ${res.status}`);
  }
  return data;
}

export async function sendOtp(phone: string, name: string, code: string) {
  if (process.env.CHATWOOT_DRY_RUN === "true") {
    console.log(`[whatsapp:dry-run] OTP para ${phone}: ${code}`);
    return;
  }
  const settings = await getSettings();
  const template = otpTemplate(settings);
  try {
    await sendOtpDirect(phone, code, template, await metaCredentials(settings));
  } catch (error) {
    // Meta refused the request, so nothing went out: the code still reaches the client through Chatwoot
    console.error("[whatsapp] envio direto pela Meta falhou, enviando pelo Chatwoot", error);
    await sendOtpViaChatwoot(phone, name, code, template);
    return;
  }
  after(() => noteOtpSent(phone, name, code).catch((error) => console.error("[chatwoot] nota do código", error)));
}

// Sends the WhatsApp "authentication" template with the code (body {{1}} + copy-code button).
async function sendOtpDirect(phone: string, code: string, template: OtpTemplate, credentials: MetaCredentials) {
  await metaApi(
    "POST",
    `/${credentials.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    },
    credentials,
  );
}

// "Testar" in Configurações: the number the credentials send from and the code template's status.
export async function checkMetaSetup() {
  const settings = await getSettings();
  const credentials = await metaCredentials(settings);
  const template = otpTemplate(settings);
  const phone = await metaApi<{ display_phone_number: string; verified_name: string; quality_rating?: string }>(
    "GET",
    `/${credentials.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    undefined,
    credentials,
  );
  const templates = await metaApi<{ data: { name: string; language: string; status: string }[] }>(
    "GET",
    `/${credentials.wabaId}/message_templates?name=${encodeURIComponent(template.name)}&fields=name,language,status`,
    undefined,
    credentials,
  );
  const found = templates.data.find((t) => t.name === template.name && t.language === template.language);
  return { source: credentials.source, phone, template, templateStatus: found?.status ?? null };
}
