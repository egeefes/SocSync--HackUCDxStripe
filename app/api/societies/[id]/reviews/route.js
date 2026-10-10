// Reviews of a society as a whole. One per student per society: posting again edits it.
// Only verified members, or students who went to one of its events, may review (see queries.js).
import db from "@/lib/db";
import { nowStamp } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { societyReviewBlockReason } from "@/lib/queries";
import { moderateReview } from "@/lib/ai-features";

async function society(params) {
  const { id } = await params;
  const s = await db.get("societies", Number(id));
  return s && s.status === "approved" ? s : null;
}

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const s = await society(params);
  if (!s) return Response.json({ error: "Society not found." }, { status: 404 });
  const blocked = await societyReviewBlockReason(user, s.id);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });

  const { stars, comment = "" } = await request.json();
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) return Response.json({ error: "Stars must be 1–5." }, { status: 400 });
  const text = String(comment).trim();
  if (text.length > 800) return Response.json({ error: "Keep it under 800 characters." }, { status: 400 });
  if (n <= 2 && text.length < 10) {
    return Response.json({ error: "For 1–2 stars, please explain what could be better (10+ characters) so the society can improve." }, { status: 400 });
  }

  let moderation = "ok";
  if (text) {
    const verdict = await moderateReview(text).catch(() => null);
    if (verdict && !verdict.allowed) return Response.json({ error: `Review not posted: ${verdict.reason}`, rewrite: verdict.suggested_rewrite }, { status: 422 });
    if (!verdict) moderation = "unchecked";
  }
  // One per student per society: posting again edits it (same Redis field, same id).
  const key = `${user.id}:${s.id}`;
  const existing = await db.get("society_reviews", key);
  const now = nowStamp();
  await db.set("society_reviews", key, {
    id: existing?.id ?? (await db.nextId("society_reviews")),
    user_id: user.id, society_id: s.id, stars: n, comment: text, moderation,
    created_at: existing?.created_at ?? now, updated_at: now,
  });
  return Response.json({ ok: true, updated: Boolean(existing) });
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const s = await society(params);
  if (!s) return Response.json({ error: "Society not found." }, { status: 404 });
  const removed = await db.delete("society_reviews", `${user.id}:${s.id}`);
  if (!removed) return Response.json({ error: "You haven't reviewed this society." }, { status: 404 });
  return Response.json({ ok: true });
}
