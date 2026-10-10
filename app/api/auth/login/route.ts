import crypto from "crypto";
import { NextResponse } from "next/server";
import { COOKIE, cookieOptionsFor, encodeSession } from "@/lib/session";
import { mutate, storeKind } from "@/lib/store";
import { HttpError, fail, readJson } from "@/lib/http";

// Demo sign-in: email + student number, no password. Replace with UCD SSO / real auth before real use.
export async function POST(request: Request) {
  try {
    if (storeKind() === "ephemeral") {
      throw new HttpError(503, "No database is configured, so accounts wouldn't persist. Add an Upstash Redis / Vercel KV store to this Vercel project (KV_REST_API_URL and KV_REST_API_TOKEN) and redeploy.");
    }
    const body = await readJson(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim().slice(0, 60);
    const studentNumber = String(body.studentNumber ?? "").trim();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
    if (!/^\d{8}$/.test(studentNumber)) throw new HttpError(400, "Student numbers are 8 digits.");
    const id = crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
    const token = encodeSession({ uid: id }); // fails fast if SESSION_SECRET is missing, before anything is written
    const isNew = await mutate((db) => {
      const existing = db.users[id];
      if (existing) {
        if (existing.studentNumber !== studentNumber) throw new HttpError(401, "That email is registered with a different student number.");
        return false;
      }
      if (name.length < 2) throw new HttpError(400, "Add your name to create an account.");
      db.users[id] = { id, name, email, studentNumber, interests: [], saved: [], createdAt: new Date().toISOString() };
      return true;
    });
    const res = NextResponse.json({ ok: true, isNew });
    res.cookies.set(COOKIE, token, cookieOptionsFor(request));
    return res;
  } catch (e) { return fail(e); }
}
