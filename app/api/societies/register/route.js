// Apply to register a society. Works for:
//   - a logged-in student (society details only), or
//   - someone new (their account details + society details, created together).
// The society stays hidden ('pending') until the SocSync admin checks it against the Students' Union
// list and confirms the applicant is on the committee. Approval makes the applicant the society's admin.
import db, { CATEGORIES, COMMITTEE_ROLES as ROLES } from "@/lib/db";
import { getCurrentUser, startSession } from "@/lib/session";
import { createStudentAccount } from "@/lib/accounts";
import { normalizeInstagram, nowStamp } from "@/lib/format";

export async function POST(request) {
  const b = await request.json();
  let user = await getCurrentUser();
  if (user && user.role !== "student") {
    return Response.json({ error: "Only student accounts can apply to register a society." }, { status: 403 });
  }
  if (user) {
    const open = (await db.all("societies")).find((s) => s.applicant_user_id === user.id && s.status === "pending");
    if (open) return Response.json({ error: `You already have an application waiting: ${open.name}.` }, { status: 409 });
  }

  // Check the society details BEFORE creating any account, so a mistake doesn't leave a half-made account.
  const name = String(b.name ?? "").trim();
  const description = String(b.description ?? "").trim();
  const evidence = String(b.evidence ?? "").trim();
  const fee = Math.round(Number(b.membership_fee_eur || 0) * 100);
  const errors = [];
  if (name.length < 3 || name.length > 80) errors.push("Society name must be 3–80 characters.");
  if (!CATEGORIES.includes(b.category)) errors.push("Pick a category.");
  if (description.length < 20) errors.push("Describe the society in at least 20 characters.");
  if (!ROLES.includes(b.role)) errors.push("Pick your committee role.");
  if (evidence.length < 20) errors.push("Tell us how we can verify the society and your role (at least 20 characters).");
  if (!Number.isFinite(fee) || fee < 0 || (fee > 0 && fee < 50)) errors.push("Membership fee must be 0 or at least €0.50.");
  const insta = normalizeInstagram(b.instagram); // optional; "@handle" or null
  if (insta.error) errors.push(insta.error);
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });
  if ((await db.all("societies")).some((s) => s.name.toLowerCase() === name.toLowerCase() && s.status !== "rejected")) {
    return Response.json({ error: "A society with this name is already on SocSync or waiting for approval." }, { status: 409 });
  }

  // New person: create their (pending) account first, using the account fields from the same form.
  if (!user) {
    const created = await createStudentAccount({ name: b.applicantName, studentNumber: b.studentNumber, email: b.email, password: b.password });
    if (created.error) return Response.json({ error: created.error }, { status: created.status });
    await startSession(created.id);
    user = { id: created.id };
  }

  const society = await db.insert("societies", {
    name, category: b.category, description, instagram: insta.handle, membership_fee_cents: fee, plan: "free", ai_imports_used: 0,
    stripe_subscription_id: null, stripe_account_id: null, status: "pending", applicant_user_id: user.id, applicant_role: b.role,
    evidence, review_note: null, applied_at: nowStamp(), bio: null, committee_json: null,
  });
  return Response.json({ id: society.id, status: "pending" });
}
