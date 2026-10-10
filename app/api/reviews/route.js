// Students review events they attended. The AI screens each review for abuse before it is published.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getEvent, reviewBlockReason } from "@/lib/queries";
import { moderateReview } from "@/lib/ai-features";

export async function POST(request) {
  const { user, error } = await requireUser({ verified: true });
  if (error) return error;
  const { eventId, stars, comment = "" } = await request.json();

  const event = getEvent(Number(eventId), user.id);
  const blocked = reviewBlockReason(event, user);
  if (blocked) return Response.json({ error: blocked }, { status: 400 });

  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) return Response.json({ error: "Stars must be 1–5." }, { status: 400 });
  const text = String(comment).trim();
  if (text.length > 1000) return Response.json({ error: "Comment must be under 1000 characters." }, { status: 400 });
  if (n <= 2 && text.length < 10) {
    return Response.json({ error: "For 1–2 stars, please explain what could be better (10+ characters) so the society can improve." }, { status: 400 });
  }

  // AI moderation. If the AI is down we still accept the review but mark it 'unchecked'.
  let moderation = "ok";
  if (text) {
    const verdict = await moderateReview(text).catch((err) => {
      console.error("[moderation]", err.message);
      return null;
    });
    if (verdict && !verdict.allowed) {
      return Response.json({ error: `Review not posted: ${verdict.reason}`, rewrite: verdict.suggested_rewrite }, { status: 422 });
    }
    if (!verdict) moderation = "unchecked";
  }

  db.prepare("INSERT INTO reviews (user_id, event_id, stars, comment, moderation) VALUES (?, ?, ?, ?, ?)").run(
    user.id,
    event.id,
    n,
    text,
    moderation
  );
  return Response.json({ ok: true, moderation });
}
