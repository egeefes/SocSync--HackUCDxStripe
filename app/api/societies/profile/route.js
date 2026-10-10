// Society admin updates the society's public profile. Only the fields sent are changed:
//   instagram | bio | committee [{ name, role, bio }] | avatar | cover | card
// Pictures are data URLs (resized in the browser); "" removes a picture.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalizeInstagram, nowStamp } from "@/lib/format";

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

  // Text fields all live on the society row: change them in one write.
  const patch = {};
  if (insta) { patch.instagram = insta.handle; out.instagram = insta.handle; }
  if ("bio" in b) patch.bio = String(b.bio ?? "").trim() || null;
  if (committee) patch.committee_json = committee.length ? JSON.stringify(committee) : null;
  if (Object.keys(patch).length) await db.update("societies", sid, patch);

  // Pictures: the image data and a small "meta" row (so lists can show flags without loading the images).
  for (const kind of ["avatar", "cover", "card"]) {
    if (!(kind in b)) continue;
    const key = `${sid}:${kind}`;
    if (b[kind] === "") {
      await Promise.all([db.delete("society_media", key), db.delete("society_media_meta", key)]);
    } else {
      await db.set("society_media", key, { image_data: b[kind] });
      await db.set("society_media_meta", key, { society_id: sid, kind, updated_at: nowStamp() });
    }
  }
  return Response.json({ ok: true, ...out });
}
