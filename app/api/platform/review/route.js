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
    const found = await db.get("users", Number(id));
    const user = found && found.status === "pending" ? found : null;
    if (!user) return Response.json({ error: "No pending student with that id." }, { status: 404 });
    await db.update("users", user.id, {
      status: decision === "approve" ? "verified" : "rejected",
      review_note: decision === "reject" ? note.trim() : null,
    });
    return Response.json({ ok: true });
  }

  if (type === "society") {
    const foundSociety = await db.get("societies", Number(id));
    const society = foundSociety && foundSociety.status === "pending" ? foundSociety : null;
    if (!society) return Response.json({ error: "No pending society with that id." }, { status: 404 });
    if (decision === "reject") {
      await db.update("societies", society.id, { status: "rejected", review_note: note.trim() });
      return Response.json({ ok: true });
    }
    // Approve: society goes live, and the applicant becomes its admin (and is verified as a student).
    await db.update("societies", society.id, { status: "approved", review_note: null });
    await db.update("users", society.applicant_user_id, { role: "admin", society_id: society.id, status: "verified" });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Type must be student or society." }, { status: 400 });
}
