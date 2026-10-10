// Society admins edit (PATCH) or delete (DELETE) one of THEIR society's upcoming events.
// Attendees who connected Google Calendar get the change (or removal) synced automatically.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { validateEvent } from "@/lib/events";
import { nowLocal } from "@/lib/format";
import { syncEventQuietly } from "@/lib/google";

async function ownEvent(params, user) {
  const { id } = await params;
  return db.prepare("SELECT * FROM events WHERE id = ? AND society_id = ?").get(Number(id), user.society_id);
}

const calendarUsers = (eventId) => db.prepare("SELECT user_id FROM google_events WHERE event_id = ?").all(eventId).map((r) => r.user_id);

export async function PATCH(request, { params }) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const event = await ownEvent(params, user);
  if (!event) return Response.json({ error: "Event not found for your society." }, { status: 404 });
  if (event.start < nowLocal()) return Response.json({ error: "Past events can't be edited." }, { status: 400 });

  const { errors, values: v } = validateEvent(await request.json());
  const { going } = db.prepare("SELECT COUNT(*) AS going FROM rsvps WHERE event_id = ?").get(event.id);
  const { sold } = db.prepare("SELECT COUNT(*) AS sold FROM payments WHERE event_id = ? AND kind = 'ticket'").get(event.id);
  if (v.capacity != null && v.capacity < going) errors.push(`Capacity can't be lower than the ${going} people already going.`);
  if (sold > 0 && v.price !== event.price_cents) errors.push("Tickets have already been sold, so the price can't change.");
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });

  db.prepare("UPDATE events SET title = ?, description = ?, venue = ?, start = ?, end = ?, price_cents = ?, capacity = ? WHERE id = ?")
    .run(v.title, v.description, v.venue, v.start, v.end, v.price, v.capacity, event.id);
  for (const uid of calendarUsers(event.id)) await syncEventQuietly(uid, event.id); // update their Google Calendar
  return Response.json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const event = await ownEvent(params, user);
  if (!event) return Response.json({ error: "Event not found for your society." }, { status: 404 });
  const { sold } = db.prepare("SELECT COUNT(*) AS sold FROM payments WHERE event_id = ?").get(event.id);
  if (sold > 0) {
    return Response.json({ error: "Paid tickets were sold for this event. Refund them in Stripe first, then delete it." }, { status: 409 });
  }

  // Remove it from attendees' Google Calendars first (no RSVP -> sync removes the calendar entry).
  const synced = calendarUsers(event.id);
  db.prepare("DELETE FROM rsvps WHERE event_id = ?").run(event.id);
  for (const uid of synced) await syncEventQuietly(uid, event.id);

  db.exec("BEGIN");
  try {
    for (const table of ["reviews", "event_posters", "google_events"]) db.prepare(`DELETE FROM ${table} WHERE event_id = ?`).run(event.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(event.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return Response.json({ ok: true });
}
