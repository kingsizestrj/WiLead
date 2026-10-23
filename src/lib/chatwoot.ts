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

// Fallback for when Meta refuses the direct send (see whatsapp.ts): the WhatsApp "authentication"
// template goes out through Chatwoot, in a conversation created resolved.
export async function sendOtpViaChatwoot(phone: string, name: string, code: string, template: { name: string; language: string }) {
  const contactId = await findOrCreateContact(phone, name);
  await api("POST", "/conversations", {
    inbox_id: env().inboxId,
    contact_id: contactId,
    status: "resolved",
    message: {
      content: `${code} é o seu código de acesso ao Wi-Fi.`,
      template_params: {
        name: template.name,
        category: "AUTHENTICATION",
        language: template.language,
        processed_params: { body: { "1": code }, buttons: [{ type: "url", parameter: code }] },
      },
    },
  });
}

// The code itself goes straight to Meta (see whatsapp.ts); this keeps it in the client's history
// as a private note, in a conversation created resolved so it stays out of the team queue.
export async function noteOtpSent(phone: string, name: string, code: string) {
  if (dryRun()) return;
  const contactId = await findOrCreateContact(phone, name);
  const conversation = await api<{ id: number }>("POST", "/conversations", {
    inbox_id: env().inboxId,
    contact_id: contactId,
    status: "resolved",
  });
  await api("POST", `/conversations/${conversation.id}/messages`, {
    content: `Código de acesso ao Wi-Fi enviado pelo WiLead: ${code}`,
    private: true,
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

export const locationLabel = (locationName: string) => `wifi-${slugLabel(locationName)}`;

// Renaming the label in Chatwoot also renames it on every tagged contact, so campaign
// audiences follow a location rename.
export async function renameLabel(oldTitle: string, newTitle: string) {
  if (oldTitle === newTitle) return;
  if (dryRun()) {
    console.log(`[chatwoot:dry-run] etiqueta ${oldTitle} -> ${newTitle}`);
    return;
  }
  const { payload } = await api<{ payload: { id: number; title: string }[] }>("GET", "/labels");
  const label = payload.find((l) => l.title === oldTitle);
  if (!label) return;
  if (payload.some((l) => l.title === newTitle)) throw new Error(`A etiqueta ${newTitle} já existe no Chatwoot`);
  await api("PATCH", `/labels/${label.id}`, { title: newTitle });
  knownLabels.delete(oldTitle);
  knownLabels.add(newTitle);
}

// Keeps the contact segmented for Chatwoot campaigns:
// labels "wifi", "wifi-<hotspot server>" and "wifi-promocoes" (only with opt-in),
// plus custom attributes with the last location and visit count.
export async function syncContact(opts: {
  contactId: number;
  locationLabel: string;
  locationName: string;
  optIn: boolean;
  visits: number;
  // Labels of landing page buttons the device clicked (e.g. lead-verao)
  leadLabels: string[];
}) {
  if (dryRun()) {
    console.log(`[chatwoot:dry-run] sync contato ${opts.contactId} local=${opts.locationLabel} optIn=${opts.optIn} leads=${opts.leadLabels}`);
    return;
  }
  const wanted = ["wifi", opts.locationLabel, ...(opts.optIn ? [PROMO_LABEL] : []), ...opts.leadLabels];
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

// Adds labels to a contact keeping the ones it already has.
export async function addContactLabels(contactId: number, labels: string[]) {
  if (dryRun()) {
    console.log(`[chatwoot:dry-run] contato ${contactId} += ${labels}`);
    return;
  }
  await ensureLabels(labels);
  const current = await api<{ payload: string[] }>("GET", `/contacts/${contactId}/labels`);
  await api("POST", `/contacts/${contactId}/labels`, { labels: [...new Set([...current.payload, ...labels])] });
}

// Label titles of the account (suggestions in the panel).
export async function accountLabels() {
  const res = await api<{ payload: { title: string }[] }>("GET", "/labels");
  return res.payload.map((l) => l.title).sort();
}

const MAX_FILTER_PAGES = 60;
type FilterContact = { phone_number: string | null };

// Phones (digits) of contacts that have the label on the contact or on any conversation.
export async function phonesWithLabel(label: string) {
  const payload = [{ attribute_key: "labels", filter_operator: "equal_to", values: [label], query_operator: null }];
  const phones = new Set<string>();
  const add = (c: FilterContact | undefined) => c?.phone_number && phones.add(c.phone_number.replace(/\D/g, ""));
  for (let page = 1; page <= MAX_FILTER_PAGES; page++) {
    const res = await api<{ payload: FilterContact[] }>("POST", `/contacts/filter?page=${page}`, { payload });
    if (!res.payload.length) break;
    res.payload.forEach(add);
  }
  for (let page = 1; page <= MAX_FILTER_PAGES; page++) {
    const res = await api<{ payload: { meta: { sender: FilterContact } }[] }>("POST", `/conversations/filter?page=${page}`, { payload });
    if (!res.payload.length) break;
    res.payload.forEach((c) => add(c.meta.sender));
  }
  return phones;
}

// Meta credentials (token + WhatsApp Business Account) already configured on the Chatwoot inbox.
// Requires the API token of an administrator.
export async function whatsappInboxConfig() {
  const inbox = await api<{ provider_config?: { api_key: string; business_account_id: string; phone_number_id: string } }>(
    "GET",
    `/inboxes/${env().inboxId}`,
  );
  if (!inbox.provider_config) throw new Error("O token do Chatwoot precisa ser de um administrador para acessar a caixa do WhatsApp.");
  return {
    token: inbox.provider_config.api_key,
    wabaId: inbox.provider_config.business_account_id,
    phoneNumberId: inbox.provider_config.phone_number_id,
  };
}

export async function syncInboxTemplates() {
  await api("POST", `/inboxes/${env().inboxId}/sync_templates`);
}
