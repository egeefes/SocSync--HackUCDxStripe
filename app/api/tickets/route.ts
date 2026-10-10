import { NextResponse } from "next/server";
import { fail, readJson, requireUser, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";
import { findEvent, goingCount, newCode, newId } from "@/lib/domain";
import { nowDublin } from "@/lib/format";

// Reserve a free ticket. Paid tickets are created by a verified Stripe payment, never here.
export async function POST(request: Request) {
  try {
    const { eventId } = await readJson(request);
    const id = Number(eventId);
    const ticket = await mutate((db) => {
      const user = requireUser(db);
      const event = findEvent(db, id);
      if (!event) throw new HttpError(404, "Event not found.");
      if (!db.memberships.some((m) => m.userId === user.id && m.societyId === event.societyId && m.status === "confirmed")) throw new HttpError(403, "Join this society before reserving a place at its events.");
      if (event.price > 0) throw new HttpError(400, "This event needs a paid ticket.");
      if (event.startsAt < nowDublin()) throw new HttpError(400, "This event has already started.");
      if (db.tickets.some((t) => t.userId === user.id && t.eventId === id)) throw new HttpError(409, "You already have a ticket.");
      if (goingCount(db, event) >= event.capacity) throw new HttpError(409, "Sorry, this event is full.");
      const t = { id: newId(), eventId: id, userId: user.id, kind: "reserved" as const, code: newCode(), createdAt: new Date().toISOString() };
      db.tickets.push(t);
      return t;
    });
    return NextResponse.json({ ok: true, ticket });
  } catch (e) { return fail(e); }
}

// Cancel a free reservation. Paid tickets need a refund from the society, so they can't be cancelled here.
export async function DELETE(request: Request) {
  try {
    const { ticketId } = await readJson(request);
    await mutate((db) => {
      const user = requireUser(db);
      const i = db.tickets.findIndex((t) => t.id === ticketId && t.userId === user.id);
      if (i < 0) throw new HttpError(404, "Ticket not found.");
      if (db.tickets[i].kind !== "reserved") throw new HttpError(400, "Paid tickets can't be cancelled here. Contact the society for a refund.");
      db.tickets.splice(i, 1);
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
