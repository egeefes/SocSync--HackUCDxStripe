// AI feature 3: summary of what students say about a society. Cached until a new review arrives.
import db from "@/lib/db";
import { nowStamp } from "@/lib/format";
import { societyReviews, societyOwnReviews } from "@/lib/queries";
import { summariseReviews } from "@/lib/ai-features";
import { aiErrorResponse } from "@/lib/openrouter";

export async function POST(request) {
  const { societyId } = await request.json();
  const society = await db.get("societies", Number(societyId));
  if (!society) return Response.json({ error: "Society not found." }, { status: 404 });

  // Event reviews + reviews of the society as a whole.
  const reviews = [
    ...(await societyReviews(society.id)),
    ...(await societyOwnReviews(society.id)).map((r) => ({ ...r, event_title: "the society overall" })),
  ];
  const cached = await db.get("ai_summaries", society.id);
  if (cached && cached.review_count === reviews.length) {
    return Response.json({ ...JSON.parse(cached.summary_json), review_count: reviews.length, cached: true });
  }

  try {
    const summary = await summariseReviews(society.name, reviews);
    await db.set("ai_summaries", society.id, {
      society_id: society.id, review_count: reviews.length, summary_json: JSON.stringify(summary), created_at: nowStamp(),
    });
    return Response.json({ ...summary, review_count: reviews.length, cached: false });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
