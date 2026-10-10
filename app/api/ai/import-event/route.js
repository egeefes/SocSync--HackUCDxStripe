// AI feature 1: society admin uploads a poster and/or pastes a caption -> pre-filled event form.
// Free plan: a few imports to try it. Pro plan: unlimited.
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { extractEvent, FREE_AI_IMPORTS } from "@/lib/ai-features";
import { aiErrorResponse } from "@/lib/openrouter";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(user.society_id);

  if (society.plan !== "pro" && society.ai_imports_used >= FREE_AI_IMPORTS) {
    return Response.json(
      { error: `You've used your ${FREE_AI_IMPORTS} free AI imports. Upgrade to Pro for unlimited imports.`, upgrade: true },
      { status: 402 }
    );
  }

  const { text = "", imageDataUrl = null } = await request.json();
  if (!text.trim() && !imageDataUrl) return Response.json({ error: "Upload a poster or paste a caption first." }, { status: 400 });
  if (imageDataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(imageDataUrl)) {
      return Response.json({ error: "Image must be PNG, JPG, WEBP or GIF." }, { status: 400 });
    }
    if (imageDataUrl.length * 0.75 > MAX_IMAGE_BYTES) return Response.json({ error: "Image is too large (max 5 MB)." }, { status: 413 });
  }

  try {
    const result = await extractEvent({ text, imageDataUrl });
    db.prepare("UPDATE societies SET ai_imports_used = ai_imports_used + 1 WHERE id = ?").run(society.id);
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
