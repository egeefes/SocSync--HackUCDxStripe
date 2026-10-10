"use client";
// Approve / reject buttons for one pending student or society. Rejecting requires a reason.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewDecision({ type, id }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/platform/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, decision, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not save the decision.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {!rejecting ? (
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => decide("approve")}>✓ Approve</button>
          <button className="btn-secondary" disabled={busy} onClick={() => setRejecting(true)}>✗ Reject…</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="input" autoFocus value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Reason the applicant will see, e.g. not on the SU societies list" />
          <div className="flex gap-2">
            <button className="btn-primary !bg-red-600" disabled={busy} onClick={() => decide("reject")}>Confirm reject</button>
            <button className="btn-secondary" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
