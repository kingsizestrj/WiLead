import { wileadUrls } from "@/lib/mikrotik-setup";

// Hotspot rlogin.html installed on the routers: the MikroTik answers any page opened before
// login with it, including the captive portal check phones make when they join the Wi-Fi.
// The default one redirects to the router's /login, which then redirects to WiLead; this one
// answers the check with a 302 straight to the portal, so the phone opens it in one step.
// The two $(if ...) lines are MikroTik directives that set the HTTP status and Location header.
export const dynamic = "force-dynamic";

export function GET() {
  const { publicUrl } = wileadUrls();
  const portal = `${publicUrl}/p?mac=$(mac-esc)&ip=$(ip)&server=$(server-name)&iface=$(interface-name)&login=$(link-login-only-esc)&dst=$(link-orig-esc)`;
  const href = portal.replaceAll("&", "&amp;");
  const html = `$(if http-status == 302)Hotspot login required$(endif)
$(if http-header == "Location")${portal}$(endif)
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${href}">
  <meta http-equiv="pragma" content="no-cache">
  <meta http-equiv="expires" content="-1">
  <title>Wi-Fi</title>
</head>
<body>
  <a href="${href}">Clique para conectar</a>
</body>
</html>
`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
