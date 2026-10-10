// Follow / unfollow a society (toggle). Followed societies' events appear on "My calendar".
import db from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { societyId } = await request.json();
  if (!db.prepare("SELECT 1 FROM societies WHERE id = ? AND status = 'approved'").get(Number(societyId))) {
    return Response.json({ error: "Society not found." }, { status: 404 });
  }
  const removed = db.prepare("DELETE FROM follows WHERE user_id = ? AND society_id = ?").run(user.id, societyId);
  if (removed.changes === 0) {
    db.prepare("INSERT INTO follows (user_id, society_id) VALUES (?, ?)").run(user.id, societyId);
  }
  return Response.json({ following: removed.changes === 0 });
}
