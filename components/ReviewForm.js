"use client";
// Star rating + comment. The server checks eligibility and runs AI moderation.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({ eventId }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rewrite, setRewrite] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!stars) return setError("Pick a star rating first.");
    setBusy(true);
    setError("");
    setRewrite("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, stars, comment }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not post review.");
      if (data.rewrite) setRewrite(data.rewrite);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-semibold">Rate this event</h3>
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}
            className={n <= stars ? "text-amber-500" : "text-gray-300"}>★</button>
        ))}
      </div>
      <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={stars && stars <= 2 ? "What could the society do better? (required for 1–2 stars)" : "What did you think? (optional)"} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rewrite && (
        <div className="rounded-lg bg-accent-soft p-3 text-sm">
          <p className="mb-2">AI-suggested version that keeps your feedback:</p>
          <p className="italic">“{rewrite}”</p>
          <button type="button" className="btn-secondary mt-2" onClick={() => { setComment(rewrite); setRewrite(""); setError(""); }}>
            Use this version
          </button>
        </div>
      )}
      <button className="btn-primary" disabled={busy}>{busy ? "Checking & posting…" : "Post review"}</button>
    </form>
  );
}
