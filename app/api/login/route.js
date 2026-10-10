// One-click login for DEMO accounts only (seeded data, no password). Used on /login and by test scripts.
import db from "@/lib/db";
import { startSession, homeFor } from "@/lib/session";

export async function POST(request) {
  const { userId } = await request.json();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(userId));
  if (!user) return Response.json({ error: "Unknown user." }, { status: 404 });
  if (!user.is_demo) return Response.json({ error: "Only demo accounts can log in without a password." }, { status: 403 });
  await startSession(user.id);
  return Response.json({ ok: true, redirect: homeFor(user) });
}
