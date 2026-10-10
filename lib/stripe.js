// Stripe (SANDBOX ONLY). Three things can be bought:
//   - 'pro'        : Society Pro subscription (€5/month) - this is how SocSync makes money from societies
//   - 'ticket'     : a paid event ticket (e.g. a ball or a weekend trip)
//   - 'membership' : yearly society membership
// Tickets and memberships go to the society's Stripe Connect account if it has set up payouts,
// with a small platform fee kept by SocSync.
import Stripe from "stripe";
import db from "./db";

export const PRO_PRICE_CENTS = 500;
export const PLATFORM_FEE_PERCENT = 5;

let client;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing in .env.local).");
  if (!key.startsWith("sk_test_")) throw new Error("Refusing to run: use a Stripe SANDBOX key (sk_test_...).");
  return (client ??= new Stripe(key));
}

export function baseUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function platformFee(amountCents) {
  return Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100);
}

// Called after Stripe confirms payment (from the success redirect AND/OR the webhook).
// Safe to call twice for the same session: the UNIQUE stripe_session_id makes it a no-op.
export function fulfilCheckout(session) {
  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { ok: false, reason: `Payment not completed (status: ${session.status}, payment: ${session.payment_status}).` };
  }
  const m = session.metadata || {};
  const societyId = Number(m.society_id);
  const userId = m.user_id ? Number(m.user_id) : null;
  const eventId = m.event_id ? Number(m.event_id) : null;
  const amount = session.amount_total ?? 0;

  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO payments (kind, user_id, society_id, event_id, amount_cents, platform_fee_cents, stripe_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(m.kind, userId, societyId, eventId, amount, m.kind === "pro" ? amount : platformFee(amount), session.id);

  if (m.kind === "pro") {
    db.prepare("UPDATE societies SET plan = 'pro', stripe_subscription_id = ? WHERE id = ?").run(
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      societyId
    );
  }
  if (m.kind === "ticket" && userId && eventId) {
    // A ticket also counts as an RSVP (so the student can review the event afterwards).
    db.prepare("INSERT OR IGNORE INTO rsvps (user_id, event_id) VALUES (?, ?)").run(userId, eventId);
  }
  if (m.kind === "membership" && userId) {
    db.prepare("INSERT OR IGNORE INTO follows (user_id, society_id) VALUES (?, ?)").run(userId, societyId);
  }
  return { ok: true, kind: m.kind, societyId, eventId, userId, alreadyRecorded: inserted.changes === 0 };
}
