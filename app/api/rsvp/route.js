// RSVP / cancel RSVP (toggle) for a free event.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { nowLocal } from "@/lib/format";
import { syncEventQuietly } from "@/lib/google";

export async function POST(request) {
  const { user, error } = await requireUser({ verified: true });
  if (error) return error;
  const { eventId } = await request.json();
  const event = await db.get("events", Number(eventId));
  if (!event) return Response.json({ error: "Event not found." }, { status: 404 });
  if (event.price_cents > 0) return Response.json({ error: "This is a paid event: buy a ticket instead." }, { status: 400 });
  if (event.start < nowLocal()) return Response.json({ error: "This event has already started." }, { status: 400 });

  const key = `${user.id}:${event.id}`;
  const removed = await db.delete("rsvps", key);
  if (removed === 0) {
    const n = (await db.all("rsvps")).filter((r) => r.event_id === event.id).length;
    if (event.capacity != null && n >= event.capacity) {
      return Response.json({ error: "Sorry, this event is full." }, { status: 409 });
    }
    await db.set("rsvps", key, { user_id: user.id, event_id: event.id });
  }
  await syncEventQuietly(user.id, event.id); // add to / remove from their Google Calendar if connected
  return Response.json({ going: removed === 0 });
}
