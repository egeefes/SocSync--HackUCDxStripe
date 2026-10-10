// Society admins create events here (manually, or after the AI pre-fills the form).
// Optional: repeat weekly / fortnightly / monthly (2-12 times), and an AI-designed poster.
import db, { CATEGORIES } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { validateEvent, shiftLocal, REPEATS } from "@/lib/events";
import { persistImage } from "@/lib/blob-storage";

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

  let storedPoster = poster;
  if (poster) {
    try { storedPoster = await persistImage(poster, `events/${user.society_id}/posters/${Date.now()}`); }
    catch (err) { return Response.json({ error: err.message || "Poster upload failed." }, { status: 502 }); }
  }

  const insert = db.prepare(
    `INSERT INTO events (society_id, title, description, venue, start, end, price_cents, capacity, created_via)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ids = [];
  db.exec("BEGIN");
  try {
    for (let i = 0; i < times; i++) {
      const r = insert.run(
        user.society_id, v.title, v.description, v.venue,
        shiftLocal(v.start, repeat, i), shiftLocal(v.end, repeat, i) || null,
        v.price, v.capacity, b.created_via === "ai" ? "ai" : "manual"
      );
      ids.push(Number(r.lastInsertRowid));
    }
    // The poster shows one specific date, so it only goes on the first occurrence.
    if (poster) {
      db.prepare("INSERT INTO event_posters (event_id, image_data, design_json) VALUES (?, ?, ?)").run(
        ids[0], storedPoster, b.poster_design ? JSON.stringify(b.poster_design).slice(0, 4000) : null
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return Response.json({ id: ids[0], ids });
}

export async function GET() {
  return Response.json({ categories: CATEGORIES });
}
