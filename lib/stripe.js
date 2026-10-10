// Stripe (SANDBOX ONLY). Three things can be bought:
//   - 'pro'        : Society Pro subscription (€5/month) - this is how SocSync makes money from societies
//   - 'ticket'     : a paid event ticket (e.g. a ball or a weekend trip)
//   - 'membership' : yearly society membership
// Tickets and memberships go to the society's Stripe Connect account if it has set up payouts,
// with a small platform fee kept by SocSync.
import Stripe from "stripe";
import db from "./db";
import { nowStamp } from "./format";

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
// Safe to call twice for the same session: the Stripe session id is claimed in Redis (HSETNX), so the
// payment is only ever recorded once.
export async function fulfilCheckout(session) {
  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { ok: false, reason: `Payment not completed (status: ${session.status}, payment: ${session.payment_status}).` };
  }
  const m = session.metadata || {};
  const societyId = Number(m.society_id);
  const userId = m.user_id ? Number(m.user_id) : null;
  const eventId = m.event_id ? Number(m.event_id) : null;
  const amount = session.amount_total ?? 0;

  // Find (or claim) this Stripe session's payment id; then write the payment if it isn't there yet.
  let paymentId = await db.lookup("payments_session", session.id);
  if (paymentId == null) {
    const candidate = await db.nextId("payments");
    paymentId = (await db.claim("payments_session", session.id, candidate)) ? candidate : await db.lookup("payments_session", session.id);
  }
  let alreadyRecorded = true;
  if (!(await db.has("payments", paymentId))) {
    alreadyRecorded = false;
    await db.set("payments", paymentId, {
      id: paymentId, kind: m.kind, user_id: userId, society_id: societyId, event_id: eventId, amount_cents: amount,
      platform_fee_cents: m.kind === "pro" ? amount : platformFee(amount), stripe_session_id: session.id, created_at: nowStamp(),
    });
  }

  if (m.kind === "pro") {
    await db.update("societies", societyId, {
      plan: "pro",
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    });
  }
  if (m.kind === "ticket" && userId && eventId) {
    // A ticket also counts as an RSVP (so the student can review the event afterwards).
    await db.setIfAbsent("rsvps", `${userId}:${eventId}`, { user_id: userId, event_id: eventId });
  }
  if (m.kind === "membership" && userId) {
    await db.setIfAbsent("follows", `${userId}:${societyId}`, { user_id: userId, society_id: societyId });
  }
  return { ok: true, kind: m.kind, societyId, eventId, userId, alreadyRecorded };
}
