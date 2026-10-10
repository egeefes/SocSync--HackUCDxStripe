// Society admins create events here (manually, or after the AI pre-fills the form).
// Optional: repeat weekly / fortnightly / monthly (2-12 times), and an AI-designed poster.
import db, { CATEGORIES } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { validateEvent, shiftLocal, REPEATS } from "@/lib/events";
import { nowStamp } from "@/lib/format";

export async function POST(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const b = await request.json();

  // Validation: ordinary, boundary and failure inputs all end up here.
  const { errors, values: v } = validateEvent(b);
  const repeat = b.repeat && b.repeat !== "none" ? String(b.repeat) : "none";
  const times = repeat === "none" ? 1 : Number(b.repeat_count);
  if (!(repeat in REPEATS)) errors.push("Repeat must be weekly, fortnightly or monthly.");
  else if (repeat !== "none" && (!Number.isInteger(times) || times < 2 || times > 12)) errors.push("Repeat between 2 and 12 times.");
  // Optional AI-designed poster (drawn in the browser): a JPEG/PNG data URL, max ~3 MB.
  const poster = b.poster || null;
  if (poster && !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(poster)) errors.push("Poster must be a JPEG or PNG image.");
  if (poster && poster.length > 4_000_000) errors.push("Poster image is too large.");
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });

  const ids = [];
  for (let i = 0; i < times; i++) {
    const row = await db.insert("events", {
      society_id: user.society_id, title: v.title, description: v.description, venue: v.venue,
      start: shiftLocal(v.start, repeat, i), end: shiftLocal(v.end, repeat, i) || null,
      price_cents: v.price, capacity: v.capacity, created_via: b.created_via === "ai" ? "ai" : "manual",
    });
    ids.push(row.id);
  }
  // The poster shows one specific date, so it only goes on the first occurrence.
  if (poster) {
    await db.set("event_posters", ids[0], {
      event_id: ids[0], image_data: poster,
      design_json: b.poster_design ? JSON.stringify(b.poster_design).slice(0, 4000) : null, created_at: nowStamp(),
    });
  }
  return Response.json({ id: ids[0], ids });
}

export async function GET() {
  return Response.json({ categories: CATEGORIES });
}
