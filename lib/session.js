// Accounts & sessions.
// - Passwords are hashed with scrypt (built into Node) and a random salt; we never store the password.
// - Logging in creates a random session token stored in an httpOnly cookie ("sid").
// - Demo accounts (seeded data) have no password and can be entered with one click from /login.
// At launch, student sign-up would be replaced by "Sign in with Google" restricted to @ucdconnect.ie
// (UCD student accounts are Google accounts), which verifies students automatically; the platform
// admin would then only review SOCIETY applications.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "./db";

// Where each kind of account lands after logging in.
export function homeFor(user) {
  if (user.role === "admin") return "/admin";
  if (user.role === "platform") return "/platform";
  return "/";
}

// For pages: the logged-in user, or redirect to /login. With `role`, other account types are
// sent to their own home page (e.g. a society account opening the student home goes to /admin).
export async function pageUser({ role } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(homeFor(user));
  return user;
}

const COOKIE = "sid";

// ---------- passwords ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}

// ---------- sessions ----------
export async function startSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(COOKIE);
}

// The logged-in user, or null for a guest.
export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").get(token) ?? null;
}

// For API routes: returns { user } or { error: Response }.
//   verified: account must be approved (pending students can browse/follow, not RSVP/buy/review)
//   admin:    must be a society admin       platform: must be the SocSync admin
export async function requireUser({ verified = false, admin = false, platform = false } = {}) {
  const user = await getCurrentUser();
  const fail = (error, status) => ({ error: Response.json({ error }, { status }) });
  if (!user) return fail("Log in or sign up to do this.", 401);
  if (platform && user.role !== "platform") return fail("Only the SocSync admin can do this.", 403);
  if (admin && user.role !== "admin") return fail("Only society admins can do this.", 403);
  if (verified && user.status !== "verified") {
    return fail("Your account is waiting for verification by the SocSync admin. You can browse and follow societies until then.", 403);
  }
  return { user };
}
