import { SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, authSecret, verifyToken } from "./auth-edge";

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(authSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure only over HTTPS (behind the proxy); direct http://IP:3000 access would drop the cookie
    secure: (await headers()).get("x-forwarded-proto") === "https",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireAdmin() {
  const userId = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) redirect("/login");
  return userId;
}
