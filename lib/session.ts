import crypto from "crypto";
import { cookies } from "next/headers";

export const COOKIE = "cl_session";
export type Session = { uid: string; committeeOf?: string; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "campusloop-dev-secret";
}
const mac = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodeSession(s: { uid: string; committeeOf?: string }) {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + 14 * 864e5 })).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

export function decodeSession(token?: string | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const a = Buffer.from(sig), b = Buffer.from(mac(payload));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

export function getSession(): Session | null {
  return decodeSession(cookies().get(COOKIE)?.value);
}

// "secure" follows the actual connection, so a production build served over plain http://localhost still keeps its cookie.
export function cookieOptionsFor(request: Request) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return { httpOnly: true, sameSite: "lax" as const, secure: proto === "https", path: "/", maxAge: 14 * 24 * 60 * 60 };
}
