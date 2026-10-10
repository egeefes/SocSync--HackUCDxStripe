// "Sync now": make Google Calendar match everything the student is going to.
import { requireUser } from "@/lib/session";
import { syncAll } from "@/lib/google";

export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.google_refresh_token) return Response.json({ error: "Connect Google Calendar first." }, { status: 400 });
  const counts = await syncAll(user.id);
  if (counts.failed) return Response.json({ error: `${counts.failed} events couldn't be synced. Try again, or reconnect Google Calendar.` }, { status: 502 });
  return Response.json(counts);
}
