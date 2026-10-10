// Serves a society's uploaded picture (avatar | cover | card) as a normal image.
import db from "@/lib/db";

export async function GET(_request, { params }) {
  const { id, kind } = await params;
  const row = db.prepare("SELECT image_data FROM society_media WHERE society_id = ? AND kind = ?").get(Number(id), kind);
  if (!row) return new Response("No image", { status: 404 });
  const [, type, base64] = row.image_data.match(/^data:(image\/[a-z]+);base64,(.*)$/) ?? [];
  if (!base64) return new Response("Bad image data", { status: 500 });
  // URLs carry ?v=<updated_at>, so a new upload gets a new URL and the old one can be cached.
  return new Response(Buffer.from(base64, "base64"), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
  });
}
