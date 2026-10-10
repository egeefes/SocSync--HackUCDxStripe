// RSVP / cancel RSVP (toggle) for a free event.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { nowLocal } from "@/lib/format";
import { syncEventQuietly } from "@/lib/google";

export async function POST(request) {
  const { user, error } = await requireUser({ verified: true });
  if (error) return error;
  const { eventId } = await request.json();
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(Number(eventId));
  if (!event) return Response.json({ error: "Event not found." }, { status: 404 });
  if (event.price_cents > 0) return Response.json({ error: "This is a paid event: buy a ticket instead." }, { status: 400 });
  if (event.start < nowLocal()) return Response.json({ error: "This event has already started." }, { status: 400 });

  const removed = db.prepare("DELETE FROM rsvps WHERE user_id = ? AND event_id = ?").run(user.id, event.id);
  if (removed.changes === 0) {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ?").get(event.id);
    if (event.capacity != null && n >= event.capacity) {
      return Response.json({ error: "Sorry, this event is full." }, { status: 409 });
    }
    db.prepare("INSERT INTO rsvps (user_id, event_id) VALUES (?, ?)").run(user.id, event.id);
  }
  await syncEventQuietly(user.id, event.id); // add to / remove from their Google Calendar if connected
  return Response.json({ going: removed.changes === 0 });
}
