"use client";
// Review a society as a whole. Posting again edits your review; you can also delete it.
// The server checks eligibility (member or attended) and runs AI moderation.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";

export default function SocietyReviewForm({ societyId, societyName, mine }) {
  const router = useRouter();
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rewrite, setRewrite] = useState("");

  async function send(method, body) {
    setBusy(true);
    setError("");
    setRewrite("");
    const res = await fetch(`/api/societies/${societyId}/reviews`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save your review.");
      if (data.rewrite) setRewrite(data.rewrite);
      return false;
    }
    router.refresh();
    return true;
  }

  async function submit(e) {
    e.preventDefault();
    if (!stars) return setError("Pick a star rating first.");
    await send("POST", { stars, comment });
  }

  async function remove() {
    if (await send("DELETE")) { setStars(0); setComment(""); }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <div className="review-form-head">
        <strong>{mine ? "Edit your review of the society" : `Review ${societyName}`}</strong>
        <div className="star-picker" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} aria-label={`${n} stars`} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)}>
              <Star size={22} className={n <= (hover || stars) ? "star on" : "star"} fill={n <= (hover || stars) ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </div>
      <textarea rows={3} maxLength={800} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={stars && stars <= 2 ? "What could the society do better? (required for 1–2 stars)" : "What's the society like overall? (optional)"} />
      {error && <p className="form-error">{error}</p>}
      {rewrite && (
        <div className="rounded-lg bg-accent-soft p-3 text-xs">
          <p className="mb-1">AI-suggested version that keeps your feedback:</p>
          <p className="italic">“{rewrite}”</p>
          <button type="button" className="text-button" onClick={() => { setComment(rewrite); setRewrite(""); setError(""); }}>Use this version</button>
        </div>
      )}
      <div className="review-form-foot">
        <small>{comment.length}/800 · One review per society. Posting again edits it.</small>
        <div className="flex items-center gap-2">
          {mine && <button type="button" className="text-button danger" onClick={remove} disabled={busy}><Trash2 size={13} /> Delete</button>}
          <button className="primary-button" disabled={busy}>{busy ? "Saving…" : mine ? "Update review" : "Post review"}</button>
        </div>
      </div>
    </form>
  );
}
