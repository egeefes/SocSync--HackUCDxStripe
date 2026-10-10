// Google Calendar sync (OAuth 2.0 + Calendar API), using plain fetch, no extra libraries.
//
// How it works:
//  1. "Connect Google Calendar" sends the student to Google's consent screen (we ask ONLY for
//     permission to manage events, not to read their email or other calendars' details).
//  2. Google sends them back to /api/google/callback with a one-time code; we swap it for a
//     long-lived "refresh token" and store it on their user row.
//  3. Whenever they RSVP / buy a ticket / cancel, syncEvent() adds, updates or removes that event
//     in their primary Google Calendar. google_events remembers which Google event is which.
//
// Prototype note: refresh tokens are stored unencrypted in SQLite; a real launch would encrypt them.
import db from "./db";
import { nowLocal } from "./format";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = (origin) => `${origin}/api/google/callback`;
const appUrl = () => process.env.APP_URL || "http://localhost:3000";

// ---------- OAuth ----------

export function authUrl({ origin, state, loginHint }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // gives us a refresh token, so sync keeps working later
    prompt: "consent",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint); // pre-selects their UCD account
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code, origin) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google sign-in failed.");
  // The id_token is a signed JWT; we got it straight from Google over HTTPS, so we only decode it.
  const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString());
  return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresIn: data.expires_in, email: payload.email };
}

// Short-lived access tokens, cached in memory per user.
const tokenCache = globalThis.__socsyncGoogleTokens ?? (globalThis.__socsyncGoogleTokens = new Map());

export function rememberAccessToken(userId, accessToken, expiresIn) {
  tokenCache.set(userId, { token: accessToken, expires: Date.now() + (expiresIn - 60) * 1000 });
}

async function accessToken(user) {
  const cached = tokenCache.get(user.id);
  if (cached && cached.expires > Date.now()) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: user.google_refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === "invalid_grant") clearConnection(user.id); // they revoked access in their Google account
    throw new Error(`Google token refresh failed: ${data.error}`);
  }
  rememberAccessToken(user.id, data.access_token, data.expires_in);
  return data.access_token;
}

export function clearConnection(userId) {
  db.prepare("UPDATE users SET google_refresh_token = NULL, google_email = NULL WHERE id = ?").run(userId);
  db.prepare("DELETE FROM google_events WHERE user_id = ?").run(userId);
  tokenCache.delete(userId);
}

export async function disconnect(user) {
  if (user.google_refresh_token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(user.google_refresh_token)}`, { method: "POST" }).catch(() => {});
  }
  clearConnection(user.id);
}

// ---------- Calendar sync ----------

const pad = (n) => String(n).padStart(2, "0");
function plusHours(local, hours) {
  const d = new Date(local);
  d.setHours(d.getHours() + hours);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function googleEventBody(e) {
  return {
    summary: `${e.title} (${e.society_name})`,
    location: e.venue,
    description: `${e.description || ""}\n\nOrganised by ${e.society_name}.\nDetails: ${appUrl()}/events/${e.id}\n(Added by SocSync)`.trim(),
    start: { dateTime: `${e.start}:00`, timeZone: "Europe/Dublin" },
    end: { dateTime: `${e.end || plusHours(e.start, 2)}:00`, timeZone: "Europe/Dublin" },
    source: { title: "SocSync", url: `${appUrl()}/events/${e.id}` },
  };
}

async function google(user, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(user)}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 410 || (method === "DELETE" && res.status === 404)) return null; // already gone
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar ${method} failed (${res.status}): ${data.error?.message || ""}`);
  return data;
}

// Make the student's Google Calendar match SocSync for ONE event:
// in their calendar if they're going (RSVP or ticket) and it hasn't happened yet, otherwise removed.
export async function syncEvent(userId, eventId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user?.google_refresh_token || !googleConfigured()) return "not-connected";
  const e = db
    .prepare(
      `SELECT e.*, s.name AS society_name,
         (EXISTS (SELECT 1 FROM rsvps WHERE user_id = ? AND event_id = e.id)
          OR EXISTS (SELECT 1 FROM payments WHERE user_id = ? AND event_id = e.id AND kind = 'ticket')) AS going
       FROM events e JOIN societies s ON s.id = e.society_id WHERE e.id = ?`
    )
    .get(userId, userId, eventId);
  const link = db.prepare("SELECT google_event_id FROM google_events WHERE user_id = ? AND event_id = ?").get(userId, eventId);
  const wanted = e && e.going && e.start >= nowLocal();

  if (wanted && !link) {
    const created = await google(user, "POST", CAL_URL, googleEventBody(e));
    db.prepare("INSERT INTO google_events (user_id, event_id, google_event_id) VALUES (?, ?, ?)").run(userId, eventId, created.id);
    return "added";
  }
  if (wanted && link) {
    await google(user, "PATCH", `${CAL_URL}/${link.google_event_id}`, googleEventBody(e));
    return "updated";
  }
  if (!wanted && link) {
    await google(user, "DELETE", `${CAL_URL}/${link.google_event_id}`);
    db.prepare("DELETE FROM google_events WHERE user_id = ? AND event_id = ?").run(userId, eventId);
    return "removed";
  }
  return "nothing";
}

// Sync everything the student is going to (used right after connecting, and by "Sync now").
export async function syncAll(userId) {
  const ids = db
    .prepare(
      `SELECT event_id FROM rsvps WHERE user_id = ?
       UNION SELECT event_id FROM payments WHERE user_id = ? AND kind = 'ticket' AND event_id IS NOT NULL
       UNION SELECT event_id FROM google_events WHERE user_id = ?`
    )
    .all(userId, userId, userId)
    .map((r) => r.event_id);
  const counts = { added: 0, updated: 0, removed: 0, failed: 0 };
  for (const id of ids) {
    try {
      const r = await syncEvent(userId, id);
      if (counts[r] !== undefined) counts[r]++;
    } catch (err) {
      console.error("[google] sync failed for event", id, err.message);
      counts.failed++;
    }
  }
  return counts;
}

// Fire-and-forget helper for routes: never let a Google hiccup break an RSVP or a payment.
export async function syncEventQuietly(userId, eventId) {
  try {
    const result = await syncEvent(userId, eventId);
    if (result !== "not-connected" && result !== "nothing") console.log(`[google] event ${eventId} ${result} for user ${userId}`);
  } catch (err) {
    console.error("[google]", err.message);
  }
}
