// AI feature 5: society fills in the event form -> AI designs a poster.
// Returns the design (headline, palette, ...) + a background picture; the browser draws the final
// poster, adding the exact date/time/venue/price from the form.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { designPoster, paintPosterBackground, FREE_AI_IMPORTS } from "@/lib/ai-features";
import { aiErrorResponse } from "@/lib/openrouter";

export async function POST(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(user.society_id);
  if (society.plan !== "pro" && society.ai_imports_used >= FREE_AI_IMPORTS) {
    return Response.json({ error: `You've used your ${FREE_AI_IMPORTS} free AI uses. Upgrade to Pro for unlimited posters and imports.`, upgrade: true }, { status: 402 });
  }

  const b = await request.json();
  const title = String(b.title ?? "").trim();
  if (title.length < 3) return Response.json({ error: "Add the event title first (at least 3 characters)." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.start ?? "")) return Response.json({ error: "Add the start date and time first." }, { status: 400 });

  try {
    const { design, textModel } = await designPoster({
      title,
      description: String(b.description ?? "").slice(0, 1500),
      venue: String(b.venue ?? "").slice(0, 120),
      price_eur: Number(b.price_eur) || 0,
      society_name: society.name,
    });
    const background = await paintPosterBackground(design.art_prompt);
    db.prepare("UPDATE societies SET ai_imports_used = ai_imports_used + 1 WHERE id = ?").run(society.id);
    return Response.json({
      design,
      society: society.name,
      background: background?.url ?? null,
      models: { text: textModel, image: background?.model ?? null },
      warnings: background ? [] : ["The image AI didn't answer in time, so the poster uses a colour background. Try Regenerate for a picture."],
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
