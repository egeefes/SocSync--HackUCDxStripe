// Follow / unfollow a society (toggle). Followed societies' events appear on "My calendar".
import db from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { societyId } = await request.json();
  const society = await db.get("societies", Number(societyId));
  if (!society || society.status !== "approved") {
    return Response.json({ error: "Society not found." }, { status: 404 });
  }
  const key = `${user.id}:${society.id}`;
  const removed = await db.delete("follows", key);
  if (removed === 0) await db.set("follows", key, { user_id: user.id, society_id: society.id });
  return Response.json({ following: removed === 0 });
}
