
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

export async function pageUser({ role } = {}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(homeFor(user));

  return user;
}

const COOKIE = "sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function redisConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing Upstash Redis REST environment variables."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function redisCommand(command) {
  const { url, token } = redisConfig();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Upstash Redis returned HTTP ${response.status}.`
    );
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Upstash Redis error: ${result.error}`);
  }

  return result.result;
}

function sessionKey(token) {
  return `socsync:session:${token}`;
}

// ---------- Passwords ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  if (!stored) return false;

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const test = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  if (test.length !== expected.length) return false;

  return crypto.timingSafeEqual(test, expected);
}

// ---------- Upstash Redis sessions ----------

export async function startSession(userId) {
  // User records remain in the existing application database.
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId);

  if (!user) {
    throw new Error("Cannot create session: user not found.");
  }

  const token = crypto.randomBytes(32).toString("hex");

  await redisCommand([
    "SET",
    sessionKey(token),
    JSON.stringify(user),
    "EX",
    String(SESSION_TTL_SECONDS),
  ]);

  const cookieStore = await cookies();

  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (token) {
    try {
      await redisCommand(["DEL", sessionKey(token)]);
    } catch (error) {
      console.error("Redis session deletion failed:", error);
    }
  }

  cookieStore.delete(COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (!token) return null;

  try {
    const result = await redisCommand([
      "GET",
      sessionKey(token),
    ]);

    if (!result) return null;

    return typeof result === "string"
      ? JSON.parse(result)
      : result;
  } catch (error) {
    console.error("Redis session lookup failed:", error);
    return null;
  }
}

// ---------- API authorisation ----------

export async function requireUser({
  verified = false,
  admin = false,
  platform = false,
} = {}) {
  const user = await getCurrentUser();

  const fail = (message, status) => ({
    error: Response.json(
      { error: message },
      { status }
    ),
  });

  if (!user) {
    return fail("Log in or sign up to do this.", 401);
  }

  if (platform && user.role !== "platform") {
    return fail(
      "Only the SocSync admin can do this.",
      403
    );
  }

  if (admin && user.role !== "admin") {
    return fail(
      "Only society admins can do this.",
      403
    );
  }

  if (verified && user.status !== "verified") {
    return fail(
      "Your account is waiting for verification. You can browse and follow societies until then.",
      403
    );
  }

  return { user };
}
