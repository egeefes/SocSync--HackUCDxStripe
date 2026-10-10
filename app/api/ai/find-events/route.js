// AI feature 4: the student describes what they're into; we return matching upcoming events.
import { requireUser } from "@/lib/session";
import { listEvents } from "@/lib/queries";
import { nowLocal } from "@/lib/format";
import { findEvents, keywordMatch } from "@/lib/ai-features";

export async function POST(request) {
  const { error } = await requireUser();
  if (error) return error;
  const prompt = String((await request.json()).prompt ?? "").trim();
  if (prompt.length < 3) return Response.json({ error: "Tell us a little about what you're looking for first." }, { status: 400 });
  if (prompt.length > 300) return Response.json({ error: "Keep it under 300 characters." }, { status: 400 });

  const upcoming = listEvents().filter((e) => e.start >= nowLocal()).slice(0, 80);
  try {
    return Response.json({ mode: "ai", results: await findEvents(prompt, upcoming) });
  } catch (err) {
    console.error("[ai finder] falling back to keywords:", err.message);
    return Response.json({ mode: "keyword", results: keywordMatch(prompt, upcoming) });
  }
}
