// Creates a Stripe-hosted Checkout page and returns its URL. The browser then redirects there.
//   { kind: 'pro' }                      -> society admin subscribes to SocSync Pro (€5/month)
//   { kind: 'ticket', eventId }          -> student buys a ticket for a paid event
//   { kind: 'membership', societyId }    -> student pays a society's yearly membership
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { stripe, platformFee, PRO_PRICE_CENTS } from "@/lib/stripe";
import { nowLocal } from "@/lib/format";

const fail = (error, status = 400) => Response.json({ error }, { status });

// If the society has finished Stripe Connect onboarding, route the money to them (minus our fee).
async function payoutTo(society, amountCents) {
  if (!society.stripe_account_id) return {};
  try {
    const account = await stripe().accounts.retrieve(society.stripe_account_id);
    if (account.capabilities?.transfers !== "active") return {};
    return {
      payment_intent_data: {
        application_fee_amount: platformFee(amountCents),
        transfer_data: { destination: society.stripe_account_id },
      },
    };
  } catch {
    return {}; // fall back to collecting on the platform account
  }
}

export async function POST(request) {
  const { user, error } = await requireUser({ verified: true });
  if (error) return error;
  const origin = new URL(request.url).origin;
  const { kind, eventId, societyId } = await request.json();
  let params;

  try {
    if (kind === "pro") {
      if (user.role !== "admin") return fail("Only society admins can upgrade.", 403);
      const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(user.society_id);
      if (society.plan === "pro") return fail("Your society is already on Pro.");
      params = {
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: PRO_PRICE_CENTS,
              recurring: { interval: "month" },
              product_data: { name: "SocSync Pro", description: "Unlimited AI poster-to-event imports" },
            },
          },
        ],
        metadata: { kind, society_id: String(society.id), user_id: String(user.id) },
        cancel_url: `${origin}/admin?checkout=cancelled`,
      };
    } else if (kind === "ticket") {
      const event = db
        .prepare(
          `SELECT e.*, s.name AS society_name, (SELECT COUNT(*) FROM payments WHERE event_id = e.id AND kind = 'ticket') AS sold
           FROM events e JOIN societies s ON s.id = e.society_id WHERE e.id = ?`
        )
        .get(Number(eventId));
      if (!event) return fail("Event not found.", 404);
      if (event.start < nowLocal()) return fail("This event has already started.");
      if (!event.price_cents) return fail("This event is free: just RSVP.");
      if (event.capacity != null && event.sold >= event.capacity) return fail("Sold out.", 409);
      const owned = db.prepare("SELECT 1 FROM payments WHERE kind = 'ticket' AND event_id = ? AND user_id = ?").get(event.id, user.id);
      if (owned) return fail("You already have a ticket for this event.");
      const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(event.society_id);
      params = {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: event.price_cents,
              product_data: { name: `${event.title} (${event.society_name})`, description: `Ticket · ${event.venue}` },
            },
          },
        ],
        metadata: { kind, event_id: String(event.id), society_id: String(event.society_id), user_id: String(user.id) },
        cancel_url: `${origin}/events/${event.id}?checkout=cancelled`,
        ...(await payoutTo(society, event.price_cents)),
      };
    } else if (kind === "membership") {
      const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(Number(societyId));
      if (!society) return fail("Society not found.", 404);
      if (!society.membership_fee_cents) return fail("This society has no membership fee.");
      const member = db.prepare("SELECT 1 FROM payments WHERE kind = 'membership' AND society_id = ? AND user_id = ?").get(society.id, user.id);
      if (member) return fail("You are already a member.");
      params = {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: society.membership_fee_cents,
              product_data: { name: `${society.name} membership`, description: "Membership for the academic year" },
            },
          },
        ],
        metadata: { kind, society_id: String(society.id), user_id: String(user.id) },
        cancel_url: `${origin}/societies/${society.id}?checkout=cancelled`,
        ...(await payoutTo(society, society.membership_fee_cents)),
      };
    } else {
      return fail("Unknown purchase type.");
    }

    const session = await stripe().checkout.sessions.create({
      ...params,
      success_url: `${origin}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[stripe checkout]", err);
    return fail(err.message || "Could not start checkout.", 500);
  }
}
