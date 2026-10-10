import { NextResponse } from "next/server";
import { fail, readJson, requireCommittee, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";
import { CATEGORY_COLOR, INTERESTS } from "@/lib/data";
import { nowDublin } from "@/lib/format";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85";

export async function POST(request: Request) {
  try {
    const b = await readJson(request);
    const title = String(b.title ?? "").trim();
    const date = String(b.date ?? "");
    const time = String(b.time ?? "");
    const category = String(b.category ?? "");
    const price = Number(b.price ?? 0);
    const capacity = Number(b.capacity ?? 50);
    const recurrence = ["none", "weekly", "fortnightly", "monthly"].includes(String(b.recurrence ?? "none")) ? String(b.recurrence ?? "none") : "none";
    const imageInput = String(b.image ?? "").trim();
    if (imageInput && (!imageInput.toLowerCase().startsWith("https://") || imageInput.length > 2000)) throw new HttpError(400, "Event banner image must be a valid HTTPS URL under 2000 characters.");
    const recurrenceCount = recurrence === "none" ? 1 : Math.max(2, Math.min(12, Math.floor(Number(b.recurrenceCount ?? 4) || 4)));
    if (title.length < 3 || title.length > 100) throw new HttpError(400, "Event names need 3 to 100 characters.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new HttpError(400, "Choose a valid date and time.");
    const startsAt = `${date}T${time}`;
    if (Number.isNaN(new Date(startsAt).getTime()) || startsAt < nowDublin().slice(0, 16)) throw new HttpError(400, "Events must be in the future.");
    if (!INTERESTS.includes(category)) throw new HttpError(400, "Choose a category.");
    if (!Number.isFinite(price) || price < 0 || price > 1000 || (price > 0 && price < 0.5)) throw new HttpError(400, "Tickets are free, or €0.50 to €1000.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) throw new HttpError(400, "Capacity must be between 1 and 5000.");
    const event = await mutate((db) => {
      const { user, societyId } = requireCommittee(db);
      const created = [];
      for (let i = 0; i < recurrenceCount; i++) {
        const occurrence = new Date(`${date}T${time}:00`);
        if (recurrence === "weekly") occurrence.setDate(occurrence.getDate() + i * 7);
        else if (recurrence === "fortnightly") occurrence.setDate(occurrence.getDate() + i * 14);
        else if (recurrence === "monthly") occurrence.setMonth(occurrence.getMonth() + i);
        const occurrenceDate = `${occurrence.getFullYear()}-${String(occurrence.getMonth()+1).padStart(2,"0")}-${String(occurrence.getDate()).padStart(2,"0")}`;
        const occurrenceStartsAt = `${occurrenceDate}T${time}`;
        if (occurrenceStartsAt < nowDublin().slice(0, 16)) continue;
        const e = {
          id: Date.now() + i, title, societyId, category, startsAt: occurrenceStartsAt,
          location: String(b.location ?? "").trim().slice(0, 100) || "UCD Campus",
          price: Math.round(price * 100) / 100, capacity, baseGoing: 0,
          description: String(b.description ?? "").trim().slice(0, 1000) || "More details coming soon.",
          image: imageInput || DEFAULT_IMAGE, color: CATEGORY_COLOR[category] ?? "lavender", tags: [category.toLowerCase()], createdBy: user.id,
        };
        db.events.push(e); created.push(e);
      }
      if (!created.length) throw new HttpError(400, "The selected recurrence has no future occurrences.");
      return created;
    });
    return NextResponse.json({ ok: true, events: event, event: Array.isArray(event) ? event[0] : event });
  } catch (e) { return fail(e); }
}


export async function PATCH(request: Request) {
  try {
    const b = await readJson(request);
    const id = Number(b.id);
    const title = String(b.title ?? "").trim();
    const date = String(b.date ?? "");
    const time = String(b.time ?? "");
    const category = String(b.category ?? "");
    const price = Number(b.price ?? 0);
    const capacity = Number(b.capacity ?? 50);
    const imageInput = String(b.image ?? "").trim();
    if (!Number.isInteger(id)) throw new HttpError(400, "Choose a valid event.");
    if (title.length < 3 || title.length > 100) throw new HttpError(400, "Event names need 3 to 100 characters.");
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^\\d{2}:\\d{2}$/.test(time)) throw new HttpError(400, "Choose a valid date and time.");
    const startsAt = `${date}T${time}`;
    if (Number.isNaN(new Date(startsAt).getTime()) || startsAt < nowDublin().slice(0, 16)) throw new HttpError(400, "Events must be in the future.");
    if (!INTERESTS.includes(category)) throw new HttpError(400, "Choose a category.");
    if (!Number.isFinite(price) || price < 0 || price > 1000 || (price > 0 && price < 0.5)) throw new HttpError(400, "Tickets are free, or €0.50 to €1000.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) throw new HttpError(400, "Capacity must be between 1 and 5000.");
    if (imageInput && (!imageInput.toLowerCase().startsWith("https://") || imageInput.length > 2000)) throw new HttpError(400, "Event banner image must be a valid HTTPS URL under 2000 characters.");
    const updated = await mutate((db) => {
      const { societyId } = requireCommittee(db);
      const event = db.events.find((e) => e.id === id && e.societyId === societyId);
      if (!event) throw new HttpError(404, "Event not found for your society.");
      if (capacity < db.tickets.filter((t) => t.eventId === id).length) throw new HttpError(400, "Capacity cannot be lower than the number of tickets already sold or reserved.");
      Object.assign(event, {
        title, startsAt, category, price: Math.round(price * 100) / 100, capacity,
        location: String(b.location ?? "").trim().slice(0, 100) || "UCD Campus",
        description: String(b.description ?? "").trim().slice(0, 1000) || "More details coming soon.",
        image: imageInput || DEFAULT_IMAGE, color: CATEGORY_COLOR[category] ?? "lavender", tags: [category.toLowerCase()],
      });
      return event;
    });
    return NextResponse.json({ ok: true, event: updated });
  } catch (e) { return fail(e); }
}

export async function DELETE(request: Request) {
  try {
    const b = await readJson(request);
    const id = Number(b.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Choose a valid event.");
    await mutate((db) => {
      const { societyId } = requireCommittee(db);
      const index = db.events.findIndex((e) => e.id === id && e.societyId === societyId);
      if (index < 0) throw new HttpError(404, "Event not found for your society.");
      db.events.splice(index, 1);
      db.tickets = db.tickets.filter((t) => t.eventId !== id);
      db.reviews = db.reviews.filter((r) => !(r.targetType === "event" && r.targetId === String(id)));
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
