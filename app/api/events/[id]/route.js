// Society admins edit (PATCH) or delete (DELETE) one of THEIR society's upcoming events.
// Attendees who connected Google Calendar get the change (or removal) synced automatically.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { validateEvent } from "@/lib/events";
import { nowLocal } from "@/lib/format";
import { syncEventQuietly } from "@/lib/google";

async function ownEvent(params, user) {
  const { id } = await params;
  const event = await db.get("events", Number(id));
  return event && event.society_id === user.society_id ? event : null;
}

const calendarUsers = async (eventId) => (await db.all("google_events")).filter((g) => g.event_id === eventId).map((g) => g.user_id);

export async function PATCH(request, { params }) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const event = await ownEvent(params, user);
  if (!event) return Response.json({ error: "Event not found for your society." }, { status: 404 });
  if (event.start < nowLocal()) return Response.json({ error: "Past events can't be edited." }, { status: 400 });

  const { errors, values: v } = validateEvent(await request.json());
  const { rsvps, payments } = await db.load(["rsvps", "payments"]);
  const going = rsvps.filter((r) => r.event_id === event.id).length;
  const sold = payments.filter((p) => p.event_id === event.id && p.kind === "ticket").length;
  if (v.capacity != null && v.capacity < going) errors.push(`Capacity can't be lower than the ${going} people already going.`);
  if (sold > 0 && v.price !== event.price_cents) errors.push("Tickets have already been sold, so the price can't change.");
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });

  await db.update("events", event.id, {
    title: v.title, description: v.description, venue: v.venue, start: v.start, end: v.end, price_cents: v.price, capacity: v.capacity,
  });
  for (const uid of await calendarUsers(event.id)) await syncEventQuietly(uid, event.id); // update their Google Calendar
  return Response.json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const event = await ownEvent(params, user);
  if (!event) return Response.json({ error: "Event not found for your society." }, { status: 404 });
  const { rsvps, payments, reviews } = await db.load(["rsvps", "payments", "reviews"]);
  if (payments.some((p) => p.event_id === event.id)) {
    return Response.json({ error: "Paid tickets were sold for this event. Refund them in Stripe first, then delete it." }, { status: 409 });
  }

  // Remove it from attendees' Google Calendars first (no RSVP -> sync removes the calendar entry).
  const synced = await calendarUsers(event.id);
  await Promise.all(rsvps.filter((r) => r.event_id === event.id).map((r) => db.delete("rsvps", `${r.user_id}:${event.id}`)));
  for (const uid of synced) await syncEventQuietly(uid, event.id);

  await Promise.all([
    ...reviews.filter((r) => r.event_id === event.id).map((r) => db.delete("reviews", `${r.user_id}:${event.id}`)),
    ...synced.map((uid) => db.delete("google_events", `${uid}:${event.id}`)),
    db.delete("event_posters", event.id),
  ]);
  await db.delete("events", event.id);
  return Response.json({ ok: true });
}
