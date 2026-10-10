// SocSync admin: verify new student accounts and society applications.
import { pageUser } from "@/lib/session";
import { pendingStudents, pendingSocieties, platformStats } from "@/lib/queries";
import { euro } from "@/lib/format";
import ReviewDecision from "@/components/ReviewDecision";

export default async function PlatformPage() {
  await pageUser({ role: "platform" }); // anyone else is sent to their own home page
  const students = pendingStudents();
  const societies = pendingSocieties();
  const stats = platformStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verification requests</h1>
        <p className="text-sm text-muted">
          {stats.live_societies} live societies · {stats.verified_users} verified users · {stats.pending_societies} societies and{" "}
          {stats.pending_users} students waiting
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Society applications ({societies.length})</h2>
        <div className="card bg-accent-soft text-sm">
          <b>Before approving, check:</b> ① the society is on the Students&apos; Union official societies list ·
          ② the applicant is on its current committee (SU committee list, or ask the society&apos;s official email) ·
          ③ it isn&apos;t a duplicate of a society already on SocSync.
        </div>
        {societies.length === 0 && <p className="text-sm text-muted">Nothing waiting. 🎉</p>}
        {societies.map((s) => (
          <div key={s.id} className="card grid gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <p className="text-lg font-semibold">{s.name} <span className="chip ml-1">{s.category}</span></p>
              <p className="text-sm">{s.description}</p>
              <p className="text-xs text-muted">
                {s.instagram || "no Instagram"} · membership {euro(s.membership_fee_cents)} · applied {s.applied_at}
              </p>
              <div className="mt-2 rounded-lg border border-border p-3 text-sm">
                <p>
                  <b>Applicant:</b> {s.applicant_name} ({s.applicant_role}) · {s.applicant_email || "no email"} · student no. {s.applicant_number}
                  {s.applicant_status === "pending" && <span className="chip ml-2 !bg-amber-100 !text-amber-800">account also unverified</span>}
                </p>
                <p className="mt-1"><b>Their evidence:</b> {s.evidence}</p>
              </div>
            </div>
            <div>
              <ReviewDecision type="society" id={s.id} />
              <p className="mt-2 text-xs text-muted">Approving makes the society public and the applicant its admin.</p>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">New student accounts ({students.length})</h2>
        <div className="card bg-accent-soft text-sm">
          <b>Check:</b> the email is a real <code>@ucdconnect.ie</code> address and the student number looks valid.
          <i> At launch this step is automatic: students sign in with their UCD Google account (@ucdconnect.ie).</i>
        </div>
        {students.length === 0 && <p className="text-sm text-muted">Nothing waiting. 🎉</p>}
        {students.map((u) => (
          <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold">{u.name}</p>
              <p className="text-muted">{u.email} · student no. {u.student_number} · signed up {u.created_at}</p>
            </div>
            <ReviewDecision type="student" id={u.id} />
          </div>
        ))}
      </section>
    </div>
  );
}
