// Serves an event's AI-designed poster as a normal image (used by event cards and the event page).
import db from "@/lib/db";
import { isBlobUrl } from "@/lib/blob-storage";

export async function GET(_request, { params }) {
  const { id } = await params;
  const row = db.prepare("SELECT image_data FROM event_posters WHERE event_id = ?").get(Number(id));
  if (!row) return new Response("No poster", { status: 404 });
  if (isBlobUrl(row.image_data)) return Response.redirect(row.image_data, 302);
  const [, type, base64] = row.image_data.match(/^data:(image\/[a-z]+);base64,(.*)$/) ?? [];
  if (!base64) return new Response("Bad poster data", { status: 500 });
  return new Response(Buffer.from(base64, "base64"), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=300" },
  });
}
