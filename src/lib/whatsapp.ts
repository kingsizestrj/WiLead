// Sends OTP codes through the official WhatsApp Cloud API (Meta) using an
// "authentication" category template with a copy-code button.
export async function sendOtpWhatsApp(phone: string, code: string) {
  if (process.env.WHATSAPP_DRY_RUN === "true") {
    console.log(`[whatsapp:dry-run] OTP para ${phone}: ${code}`);
    return;
  }

  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const components: unknown[] = [{ type: "body", parameters: [{ type: "text", text: code }] }];
  if (process.env.WHATSAPP_TEMPLATE_HAS_BUTTON !== "false") {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] });
  }

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: process.env.WHATSAPP_OTP_TEMPLATE!,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR" },
        components,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  }
}
