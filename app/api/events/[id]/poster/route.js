// Serves an event's AI-designed poster as a normal image (used by event cards and the event page).
import db from "@/lib/db";

export async function GET(_request, { params }) {
  const { id } = await params;
  const row = await db.get("event_posters", Number(id));
  if (!row) return new Response("No poster", { status: 404 });
  const [, type, base64] = row.image_data.match(/^data:(image\/[a-z]+);base64,(.*)$/) ?? [];
  if (!base64) return new Response("Bad poster data", { status: 500 });
  return new Response(Buffer.from(base64, "base64"), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=300" },
  });
}
