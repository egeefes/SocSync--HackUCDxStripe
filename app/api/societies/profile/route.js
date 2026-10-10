// Society admin updates the society's public profile. Only the fields sent are changed:
//   instagram | bio | committee [{ name, role, bio }] | avatar | cover | card
// Pictures are data URLs (resized in the browser); "" removes a picture.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalizeInstagram } from "@/lib/format";
import { persistImage, deleteBlobIfPresent } from "@/lib/blob-storage";

// Max size of each picture (base64 characters ~ 1.33 x bytes).
const MAX = { avatar: 400_000, cover: 1_600_000, card: 1_000_000 };
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const b = await request.json();
  const sid = user.society_id;
  const errors = [];
  const out = {};

  let insta;
  if ("instagram" in b) {
    insta = normalizeInstagram(b.instagram);
    if (insta.error) errors.push(insta.error);
  }
  if ("bio" in b && String(b.bio ?? "").length > 2000) errors.push("About us must be under 2000 characters.");
  let committee;
  if ("committee" in b) {
    if (!Array.isArray(b.committee)) errors.push("Committee must be a list.");
    else {
      committee = b.committee
        .slice(0, 20)
        .map((m) => ({ name: String(m?.name ?? "").trim().slice(0, 60), role: String(m?.role ?? "").trim().slice(0, 60), bio: String(m?.bio ?? "").trim().slice(0, 300) }))
        .filter((m) => m.name || m.role);
      if (committee.some((m) => !m.name || !m.role)) errors.push("Every committee member needs a name and a role.");
    }
  }
  for (const kind of ["avatar", "cover", "card"]) {
    if (!(kind in b) || b[kind] === "") continue;
    if (!IMAGE_RE.test(b[kind] ?? "")) errors.push(`The ${kind === "card" ? "membership card background" : kind === "cover" ? "cover banner" : "profile picture"} must be a JPG, PNG or WEBP image.`);
    else if (b[kind].length > MAX[kind]) errors.push(`The ${kind} image is too large. Please use a smaller picture.`);
  }
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });

  // Upload new files before writing their durable URLs to the database.
  const storedImages = {};
  try {
    for (const kind of ["avatar", "cover", "card"]) {
      if (kind in b && b[kind] !== "") storedImages[kind] = await persistImage(b[kind], `societies/${sid}/${kind}`);
    }
  } catch (err) {
    return Response.json({ error: err.message || "Image upload failed." }, { status: 502 });
  }

  db.exec("BEGIN");
  try {
    if (insta) { db.prepare("UPDATE societies SET instagram = ? WHERE id = ?").run(insta.handle, sid); out.instagram = insta.handle; }
    if ("bio" in b) db.prepare("UPDATE societies SET bio = ? WHERE id = ?").run(String(b.bio ?? "").trim() || null, sid);
    if (committee) db.prepare("UPDATE societies SET committee_json = ? WHERE id = ?").run(committee.length ? JSON.stringify(committee) : null, sid);
    for (const kind of ["avatar", "cover", "card"]) {
      if (!(kind in b)) continue;
      const old = db.prepare("SELECT image_data FROM society_media WHERE society_id = ? AND kind = ?").get(sid, kind);
      if (b[kind] === "") {
        db.prepare("DELETE FROM society_media WHERE society_id = ? AND kind = ?").run(sid, kind);
        if (old) deleteBlobIfPresent(old.image_data).catch(() => {});
      } else {
        db.prepare(
          `INSERT INTO society_media (society_id, kind, image_data) VALUES (?, ?, ?)
           ON CONFLICT(society_id, kind) DO UPDATE SET image_data = excluded.image_data, updated_at = datetime('now')`
        ).run(sid, kind, storedImages[kind]);
        if (old && old.image_data !== storedImages[kind]) deleteBlobIfPresent(old.image_data).catch(() => {});
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return Response.json({ ok: true, ...out });
}
