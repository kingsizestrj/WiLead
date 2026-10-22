import { wileadUrls } from "@/lib/mikrotik-setup";

// Hotspot login page installed on the routers (the panel makes the MikroTik download it).
// MikroTik fills the $(...) variables and the browser is sent to the WiLead portal.
export const dynamic = "force-dynamic";

export function GET() {
  const { publicUrl } = wileadUrls();
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="pragma" content="no-cache">
  <title>Wi-Fi</title>
</head>
<body>
  $(if error)
  <script>var err = "$(error)";</script>
  $(else)
  <script>var err = "";</script>
  $(endif)
  <script>
    var params = new URLSearchParams({
      mac: "$(mac)",
      ip: "$(ip)",
      server: "$(server-name)",
      iface: "$(interface-name)",
      login: "$(link-login-only)",
      dst: "$(link-orig)",
      error: err
    });
    window.location.replace("${publicUrl}/p?" + params.toString());
  </script>
  <noscript><a href="${publicUrl}/p?mac=$(mac-esc)&ip=$(ip)&server=$(server-name)&iface=$(interface-name)&login=$(link-login-only-esc)&dst=$(link-orig-esc)">Clique para conectar</a></noscript>
</body>
</html>
`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
