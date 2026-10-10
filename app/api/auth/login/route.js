// Email + password login, from the "Student" or "Society" tab of the login page.
import db from "@/lib/db";
import { checkPassword, startSession, homeFor } from "@/lib/session";

export async function POST(request) {
  const { email = "", password = "", as = "student" } = await request.json();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase());
  // Same message whether the email or the password is wrong, so nobody can probe which emails exist.
  if (!user || !checkPassword(String(password), user.password_hash)) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  // Make sure people use the right tab, with a helpful message if not.
  const pendingApp = db.prepare("SELECT 1 FROM societies WHERE applicant_user_id = ? AND status = 'pending'").get(user.id);
  if (as === "society" && user.role === "student" && !pendingApp) {
    return Response.json({ error: "This is a student account. Use the Student tab, or register your society first." }, { status: 403 });
  }
  if (as === "student" && user.role === "admin") {
    return Response.json({ error: "This is a society account. Use the Society tab." }, { status: 403 });
  }

  await startSession(user.id);
  // A society still waiting for approval goes to its application status page.
  return Response.json({ ok: true, redirect: as === "society" && pendingApp ? "/register-society" : homeFor(user) });
}
