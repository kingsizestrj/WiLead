import { syncInboxTemplates } from "./chatwoot";
import { metaApi, metaCredentials } from "./whatsapp";

// WhatsApp message templates managed directly on the Meta Graph API.
// https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates

export type TemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT";
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
  buttons?: TemplateButton[];
};

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "OTP"; otp_type: "COPY_CODE"; text: string };

export type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string;
  components: TemplateComponent[];
};

export type NewTemplate = {
  name: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: TemplateComponent[];
};

// Calls on the WhatsApp Business Account of the configured credentials (see whatsapp.ts).
async function graph<T>(method: string, path: string, body?: unknown): Promise<T> {
  const credentials = await metaCredentials();
  return metaApi<T>(method, `/${credentials.wabaId}${path}`, body, credentials);
}

export async function listTemplates() {
  const res = await graph<{ data: MetaTemplate[] }>(
    "GET",
    "/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=250",
  );
  return res.data;
}

// Meta reviews the template (usually minutes); Chatwoot is asked to sync so it shows up in the inbox.
export async function createTemplate(template: NewTemplate) {
  const res = await graph<{ id: string; status: string }>("POST", "/message_templates", template);
  await syncInboxTemplates();
  return res;
}

export async function deleteTemplate(name: string) {
  await graph("DELETE", `/message_templates?name=${encodeURIComponent(name)}`);
  await syncInboxTemplates();
}
