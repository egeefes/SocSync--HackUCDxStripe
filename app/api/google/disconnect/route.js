// Stop syncing and revoke SocSync's access to the student's Google Calendar.
// (Events already added stay in their calendar; they can delete them there.)
import { requireUser } from "@/lib/session";
import { disconnect } from "@/lib/google";

export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  await disconnect(user);
  return Response.json({ ok: true });
}
