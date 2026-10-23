import { request } from "node:https";

// Self-hosted UniFi Network controller. Classic installs answer /api/login (port 8443);
// UniFi OS consoles use /api/auth/login and serve the Network API under /proxy/network.

export type UnifiConfig = { url: string; user: string; password: string; site: string };

export type UnifiDevice = {
  mac: string;
  ip: string;
  name: string;
  model: string;
  online: boolean;
  clients: number;
  uptimeSec: number;
  firmware: string;
};

type Response = { status: number; body: string; cookies: string[] };

// The controller uses a self-signed certificate.
function call(url: string, method: string, body?: unknown, cookies: string[] = []): Promise<Response> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = request(
      url,
      {
        method,
        rejectUnauthorized: false,
        timeout: 10000,
        headers: { "Content-Type": "application/json", ...(cookies.length && { Cookie: cookies.join("; ") }) },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: text, cookies: (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]) }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("a controladora UniFi não respondeu")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function unifiDevices(config: UnifiConfig): Promise<UnifiDevice[]> {
  const base = config.url.replace(/\/$/, "");
  const credentials = { username: config.user, password: config.password, remember: true };
  let login = await call(`${base}/api/login`, "POST", credentials);
  let prefix = "";
  if (login.status === 404) {
    login = await call(`${base}/api/auth/login`, "POST", credentials);
    prefix = "/proxy/network";
  }
  if (login.status >= 400) throw new Error(`login na controladora UniFi recusado (HTTP ${login.status})`);

  const res = await call(`${base}${prefix}/api/s/${config.site}/stat/device`, "GET", undefined, login.cookies);
  if (res.status >= 400) throw new Error(`controladora UniFi respondeu HTTP ${res.status} ao listar os dispositivos`);
  const devices = JSON.parse(res.body).data as Record<string, unknown>[];
  return devices
    .filter((d) => d.type === "uap")
    .map((d) => ({
      mac: String(d.mac).toUpperCase(),
      ip: String(d.ip ?? ""),
      name: String(d.name ?? d.model ?? d.mac),
      model: String(d.model ?? ""),
      online: d.state === 1,
      clients: Number(d.num_sta ?? 0),
      uptimeSec: Number(d.uptime ?? 0),
      firmware: String(d.version ?? ""),
    }));
}
