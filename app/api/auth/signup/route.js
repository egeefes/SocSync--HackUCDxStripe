// Student sign-up. New accounts start as pending until the SocSync admin verifies them.
import { createStudentAccount } from "@/lib/accounts";
import { startSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const created = createStudentAccount(body ?? {});
    if (created.error) return Response.json({ error: created.error }, { status: created.status });
    await startSession(created.id);
    return Response.json({ ok: true, status: "pending", redirect: "/login?signup=pending" });
  } catch (error) {
    console.error("[auth/signup]", error);
    return Response.json({ error: "Sign-up service is temporarily unavailable. Check Vercel → Logs for [auth/signup]." }, { status: 500 });
  }
}
