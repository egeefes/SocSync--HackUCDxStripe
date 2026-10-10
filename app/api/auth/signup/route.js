// Student sign-up. New accounts start as 'pending' until the SocSync admin verifies them.
import { createStudentAccount } from "@/lib/accounts";
import { startSession } from "@/lib/session";

export async function POST(request) {
  const created = await createStudentAccount(await request.json());
  if (created.error) return Response.json({ error: created.error }, { status: created.status });
  await startSession(created.id);
  return Response.json({ ok: true, status: "pending" });
}
