import { NextResponse } from "next/server";
import Stripe from "stripe";
import { HttpError, fail, readJson, requireUser } from "@/lib/http";
import { readDb } from "@/lib/store";
import { findEvent, findSociety, goingCount } from "@/lib/domain";
import { MEMBERSHIP_PRICE, nowDublin } from "@/lib/format";

// Prices and titles come from the server, never from the browser.
export async function POST(request: Request) {
  try {
    const { kind, eventId, societyId } = await readJson(request);
    const db = await readDb();
    const user = requireUser(db);
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new HttpError(503, "Stripe test mode isn't configured yet. Add STRIPE_SECRET_KEY to .env.local.");

    let title: string, description: string, amount: number, targetId: string, cancelPath: string;
    if (kind === "ticket") {
      const event = findEvent(db, Number(eventId));
      if (!event) throw new HttpError(404, "Event not found.");
      if (!db.memberships.some((m) => m.userId === user.id && m.societyId === event.societyId && m.status === "confirmed")) throw new HttpError(403, "Join this society before buying a ticket.");
      if (event.price <= 0) throw new HttpError(400, "This event is free. Reserve a ticket instead.");
      if (event.startsAt < nowDublin()) throw new HttpError(400, "This event has already started.");
      if (db.tickets.some((t) => t.userId === user.id && t.eventId === event.id)) throw new HttpError(409, "You already have a ticket.");
      if (goingCount(db, event) >= event.capacity) throw new HttpError(409, "Sorry, this event is full.");
      title = event.title; description = "SocSync demo event ticket";
      amount = Math.round(event.price * 100); targetId = String(event.id); cancelPath = `/events/${event.id}`;
    } else if (kind === "membership") {
      const society = findSociety(String(societyId));
      if (!society) throw new HttpError(404, "Society not found.");
      if (db.memberships.some((m) => m.userId === user.id && m.societyId === society.id)) throw new HttpError(409, "You've already joined this society.");
      title = `${society.name} membership`; description = "SocSync demo society membership";
      amount = Math.round(MEMBERSHIP_PRICE * 100); targetId = society.id; cancelPath = `/societies/${society.id}`;
    } else throw new HttpError(400, "Unknown checkout type.");
    if (amount < 50) throw new HttpError(400, "Stripe Checkout needs at least €0.50.");

    const stripe = new Stripe(secret);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amount, product_data: { name: title.slice(0, 120), description } } }],
      metadata: { kind, targetId, userId: user.id, title: title.slice(0, 120), demo: "true" },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}${cancelPath}?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError) {
      console.error("Stripe checkout error:", e.message);
      return NextResponse.json({ error: "Couldn't create checkout. Check your Stripe test keys." }, { status: 502 });
    }
    return fail(e);
  }
}
