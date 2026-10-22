import { jwtVerify } from "jose";

export const SESSION_COOKIE = "hs_session";
export const authSecret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function verifyToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
