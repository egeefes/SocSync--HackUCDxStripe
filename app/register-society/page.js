// Register a society. New people fill in their own details AND the society's in one form;
// logged-in students just fill in the society. The SocSync admin verifies it before it goes live.
import Link from "next/link";
import { CATEGORIES, COMMITTEE_ROLES } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { myApplication } from "@/lib/queries";
import JsonForm from "@/components/JsonForm";

export default async function RegisterSocietyPage() {
  const user = await getCurrentUser();

  if (user?.role === "admin") {
    return <p className="card text-sm">You already manage a society. Go to your <Link href="/admin" className="text-accent underline">dashboard</Link>.</p>;
  }
  if (user?.role === "platform") {
    return <p className="card text-sm">You&apos;re the SocSync admin. Review applications on <Link href="/platform" className="text-accent underline">Verification requests</Link>.</p>;
  }

  const app = user ? await myApplication(user.id) : null;
  if (app?.status === "pending") {
    return (
      <div className="card mx-auto max-w-lg space-y-2 text-sm">
        <h1 className="text-xl font-bold">Application received ⏳</h1>
        <p><b>{app.name}</b> is waiting for the SocSync admin to verify it.</p>
        <p className="text-muted">
          We check the society against the Students&apos; Union list and confirm you&apos;re on its committee.
          Once approved, log in with the <b>Society</b> tab to reach your society dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!user && (
        <p className="text-sm"><Link href="/login" className="text-accent underline">← Back to log in</Link></p>
      )}
      {app?.status === "rejected" && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          Your application for <b>{app.name}</b> was not approved: {app.review_note}. You can fix it and apply again below.
        </div>
      )}
      <div className="card space-y-4">
        <div>
          <h1 className="text-xl font-bold">Register your society</h1>
          <p className="text-sm text-muted">
            The SocSync admin verifies every society before it goes live, so students know it&apos;s real.
            Once approved, you become the society&apos;s admin and can post events.
          </p>
        </div>
        <JsonForm endpoint="/api/societies/register" redirectTo="/register-society" submitLabel="Submit for verification">
          {!user && (
            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">1. You (the committee member applying)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><span className="label">Full name</span><input name="applicantName" className="input" required /></div>
                <div><span className="label">Student number</span><input name="studentNumber" className="input" inputMode="numeric" placeholder="8 digits" required /></div>
                <div><span className="label">UCD student email</span><input name="email" type="email" className="input" placeholder="…@ucdconnect.ie" required /></div>
                <div><span className="label">Password (8+ characters)</span><input name="password" type="password" minLength={8} className="input" required /></div>
              </div>
              <p className="text-xs text-muted">You&apos;ll use this email and password to log in with the Society tab.</p>
            </fieldset>
          )}
          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            {!user && <legend className="px-1 text-sm font-semibold">2. Your society</legend>}
            <div><span className="label">Society name</span><input name="name" className="input" placeholder="e.g. Anime & Manga Society" required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="label">Category</span>
                <select name="category" className="input" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <span className="label">Your role on the committee</span>
                <select name="role" className="input" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {COMMITTEE_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div><span className="label">What does the society do?</span><textarea name="description" rows={3} className="input" required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><span className="label">Instagram (optional)</span><input name="instagram" className="input" placeholder="@yoursoc" /></div>
              <div><span className="label">Yearly membership fee € (0 = free)</span><input name="membership_fee_eur" type="number" min="0" step="0.5" defaultValue="2" className="input" /></div>
            </div>
            <div>
              <span className="label">How can we verify this? (Students&apos; Union listing, when you were elected, society email…)</span>
              <textarea name="evidence" rows={3} className="input" required
                placeholder="e.g. Listed on the SU societies page. I was elected auditor at our AGM on 2 October. Our society email is …" />
            </div>
          </fieldset>
        </JsonForm>
      </div>
    </div>
  );
}
