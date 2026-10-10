// The SocSync admin approves or rejects a pending student account or society application.
//   { type: 'student' | 'society', id, decision: 'approve' | 'reject', note? }
import db from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function POST(request) {
  const { error } = await requireUser({ platform: true });
  if (error) return error;
  const { type, id, decision, note = "" } = await request.json();
  if (!["approve", "reject"].includes(decision)) return Response.json({ error: "Decision must be approve or reject." }, { status: 400 });
  if (decision === "reject" && String(note).trim().length < 5) {
    return Response.json({ error: "Give a short reason when rejecting, so the applicant knows what to fix." }, { status: 400 });
  }

  if (type === "student") {
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'pending'").get(Number(id));
    if (!user) return Response.json({ error: "No pending student with that id." }, { status: 404 });
    db.prepare("UPDATE users SET status = ?, review_note = ? WHERE id = ?").run(
      decision === "approve" ? "verified" : "rejected",
      decision === "reject" ? note.trim() : null,
      user.id
    );
    return Response.json({ ok: true });
  }

  if (type === "society") {
    const society = db.prepare("SELECT * FROM societies WHERE id = ? AND status = 'pending'").get(Number(id));
    if (!society) return Response.json({ error: "No pending society with that id." }, { status: 404 });
    if (decision === "reject") {
      db.prepare("UPDATE societies SET status = 'rejected', review_note = ? WHERE id = ?").run(note.trim(), society.id);
      return Response.json({ ok: true });
    }
    // Approve: society goes live, and the applicant becomes its admin (and is verified as a student).
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE societies SET status = 'approved', review_note = NULL WHERE id = ?").run(society.id);
      db.prepare("UPDATE users SET role = 'admin', society_id = ?, status = 'verified' WHERE id = ?").run(society.id, society.applicant_user_id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Type must be student or society." }, { status: 400 });
}
