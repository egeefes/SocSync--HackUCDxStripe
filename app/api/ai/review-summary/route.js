// AI feature 3: summary of what students say about a society. Cached until a new review arrives.
import db from "@/lib/db";
import { societyReviews, societyOwnReviews } from "@/lib/queries";
import { summariseReviews } from "@/lib/ai-features";
import { aiErrorResponse } from "@/lib/openrouter";

export async function POST(request) {
  const { societyId } = await request.json();
  const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(Number(societyId));
  if (!society) return Response.json({ error: "Society not found." }, { status: 404 });

  // Event reviews + reviews of the society as a whole.
  const reviews = [
    ...societyReviews(society.id),
    ...societyOwnReviews(society.id).map((r) => ({ ...r, event_title: "the society overall" })),
  ];
  const cached = db.prepare("SELECT * FROM ai_summaries WHERE society_id = ?").get(society.id);
  if (cached && cached.review_count === reviews.length) {
    return Response.json({ ...JSON.parse(cached.summary_json), review_count: reviews.length, cached: true });
  }

  try {
    const summary = await summariseReviews(society.name, reviews);
    db.prepare(
      `INSERT INTO ai_summaries (society_id, review_count, summary_json) VALUES (?, ?, ?)
       ON CONFLICT(society_id) DO UPDATE SET review_count = excluded.review_count, summary_json = excluded.summary_json, created_at = datetime('now')`
    ).run(society.id, reviews.length, JSON.stringify(summary));
    return Response.json({ ...summary, review_count: reviews.length, cached: false });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
