// Every message to clients goes through Chatwoot (WhatsApp Cloud inbox), so the
// conversation history and campaigns live in one place.
const env = () => ({
  url: process.env.CHATWOOT_URL!.replace(/\/$/, ""),
  token: process.env.CHATWOOT_API_TOKEN!,
  accountId: process.env.CHATWOOT_ACCOUNT_ID!,
  inboxId: Number(process.env.CHATWOOT_INBOX_ID!),
});

const dryRun = () => process.env.CHATWOOT_DRY_RUN === "true";

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { url, token, accountId } = env();
  const res = await fetch(`${url}/api/v1/accounts/${accountId}${path}`, {
    method,
    headers: { api_access_token: token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Chatwoot ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : (null as T);
}

type Contact = { id: number; phone_number: string | null };

// Finds the Chatwoot contact by WhatsApp number or creates it in the WhatsApp inbox.
export async function findOrCreateContact(phone: string, name: string) {
  const e164 = `+${phone}`;
  const search = await api<{ payload: Contact[] }>("GET", `/contacts/search?q=${encodeURIComponent(e164)}`);
  const found = search.payload.find((c) => c.phone_number === e164);
  if (found) return found.id;

  const created = await api<{ payload: { contact: Contact } }>("POST", "/contacts", {
    name,
    phone_number: e164,
    inbox_id: env().inboxId,
  });
  return created.payload.contact.id;
}

// Sends the WhatsApp "authentication" template with the code (body {{1}} + copy-code button).
export async function sendOtp(phone: string, name: string, code: string) {
  if (dryRun()) {
    console.log(`[chatwoot:dry-run] OTP para ${phone}: ${code}`);
    return;
  }
  const contactId = await findOrCreateContact(phone, name);
  await api("POST", "/conversations", {
    inbox_id: env().inboxId,
    contact_id: contactId,
    status: "resolved",
    message: {
      content: `${code} é o seu código de acesso ao Wi-Fi.`,
      template_params: {
        name: process.env.WHATSAPP_OTP_TEMPLATE!,
        category: "AUTHENTICATION",
        language: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR",
        processed_params: { body: { "1": code }, buttons: [{ type: "url", parameter: code }] },
      },
    },
  });
}

const knownLabels = new Set<string>();

async function ensureLabels(labels: string[]) {
  if (!knownLabels.size) {
    const res = await api<{ payload: { title: string }[] }>("GET", "/labels");
    res.payload.forEach((l) => knownLabels.add(l.title));
  }
  for (const title of labels.filter((l) => !knownLabels.has(l))) {
    await api("POST", "/labels", { title, description: "Hotspot Wi-Fi", color: "#7c3aed", show_on_sidebar: true });
    knownLabels.add(title);
  }
}

export const slugLabel = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PROMO_LABEL = "wifi-promocoes";

// Keeps the contact segmented for Chatwoot campaigns:
// labels "wifi", "wifi-<hotspot server>" and "wifi-promocoes" (only with opt-in),
// plus custom attributes with the last location and visit count.
export async function syncContact(opts: {
  contactId: number;
  locationLabel: string;
  locationName: string;
  optIn: boolean;
  visits: number;
}) {
  if (dryRun()) {
    console.log(`[chatwoot:dry-run] sync contato ${opts.contactId} local=${opts.locationLabel} optIn=${opts.optIn}`);
    return;
  }
  const wanted = ["wifi", opts.locationLabel, ...(opts.optIn ? [PROMO_LABEL] : [])];
  await ensureLabels(wanted);

  const current = await api<{ payload: string[] }>("GET", `/contacts/${opts.contactId}/labels`);
  const labels = [...new Set([...current.payload.filter((l) => opts.optIn || l !== PROMO_LABEL), ...wanted])];
  await api("POST", `/contacts/${opts.contactId}/labels`, { labels });

  await api("PUT", `/contacts/${opts.contactId}`, {
    custom_attributes: {
      wifi_ultimo_local: opts.locationName,
      wifi_ultima_visita: new Date().toISOString(),
      wifi_visitas: opts.visits,
      wifi_aceita_promocoes: opts.optIn,
    },
  });
}
