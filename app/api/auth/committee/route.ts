import crypto from "crypto";
import { NextResponse } from "next/server";
import { COOKIE, cookieOptionsFor, encodeSession, getSession } from "@/lib/session";
import { HttpError, fail, readJson, requireUser } from "@/lib/http";
import { findSociety } from "@/lib/domain";
import { readDb } from "@/lib/store";

function expectedPasscode() {
  const p = process.env.COMMITTEE_PASSCODE;
  if (p) return p;
  if (process.env.NODE_ENV === "production") return null;
  return "committee"; // local development default only
}

// Demo committee access: one shared passcode (COMMITTEE_PASSCODE). Replace with per-society roles in a real build.
export async function POST(request: Request) {
  try {
    const db = await readDb();
    const user = requireUser(db);
    const { societyId, passcode } = await readJson(request);
    const expected = expectedPasscode();
    if (!expected) throw new HttpError(503, "COMMITTEE_PASSCODE is not configured on the server.");
    if (!findSociety(String(societyId))) throw new HttpError(400, "Choose a society.");
    const a = Buffer.from(String(passcode ?? "")), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Incorrect committee passcode.");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, encodeSession({ uid: user.id, committeeOf: String(societyId) }), cookieOptionsFor(request));
    return res;
  } catch (e) { return fail(e); }
}

export async function DELETE(request: Request) {
  try {
    const s = getSession();
    if (!s) throw new HttpError(401, "Please sign in first.");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, encodeSession({ uid: s.uid }), cookieOptionsFor(request));
    return res;
  } catch (e) { return fail(e); }
}
