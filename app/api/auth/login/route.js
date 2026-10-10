// Email + password login, from the Student or Society tab.
import db from "@/lib/db";
import { checkPassword, startSession, homeFor } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const as = body?.as === "society" ? "society" : "student";
    if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !checkPassword(password, user.password_hash)) {
      return Response.json({ error: "Wrong email or password. Demo accounts can be opened using the demo buttons below." }, { status: 401 });
    }

    const pendingApp = db.prepare("SELECT 1 FROM societies WHERE applicant_user_id = ? AND status = 'pending'").get(user.id);
    if (as === "society" && user.role === "student" && !pendingApp) {
      return Response.json({ error: "This is a student account. Use the Student tab, or register your society first." }, { status: 403 });
    }
    if (as === "student" && user.role === "admin") {
      return Response.json({ error: "This is a society account. Use the Society tab." }, { status: 403 });
    }

    await startSession(user.id);
    return Response.json({ ok: true, redirect: as === "society" && pendingApp ? "/register-society" : homeFor(user) });
  } catch (error) {
    console.error("[auth/login]", error);
    return Response.json({ error: "Login service is temporarily unavailable. Check Vercel → Logs for [auth/login]." }, { status: 500 });
  }
}
