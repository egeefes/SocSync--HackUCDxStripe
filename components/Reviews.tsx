"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Star, Trash2 } from "lucide-react";
import type { Rating, ReviewView } from "@/lib/types";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { Stars } from "./Stars";
import { useToast } from "./Toast";

type Props = {
  targetType: "event" | "society"; targetId: string; targetName: string;
  reviews: ReviewView[]; rating: Rating; signedIn: boolean; nextPath: string;
};

export function Reviews({ targetType, targetId, targetName, reviews, rating, signedIn, nextPath }: Props) {
  const router = useRouter();
  const mine = reviews.find((r) => r.mine);
  const [stars, setStars] = useState(mine?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(mine?.text ?? "");
  const [busy, setBusy] = useState(false);
  const { notify, toast } = useToast();
  const label = targetType === "event" ? "event" : "society";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stars) { notify("Choose a star rating first."); return; }
    setBusy(true);
    try {
      await api("/api/reviews", "POST", { targetType, targetId, rating: stars, text });
      notify(mine ? "Review updated." : "Thanks for your review!");
      router.refresh();
    } catch (err) { notify(err instanceof Error ? err.message : "Couldn't save your review."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await api("/api/reviews", "DELETE", { reviewId: id }); setStars(0); setText(""); notify("Review deleted."); router.refresh(); }
    catch (err) { notify(err instanceof Error ? err.message : "Couldn't delete."); }
  }

  return <section className="reviews" id="reviews">
    <div className="section-heading">
      <div><div className="eyebrow">{targetType === "event" ? "EVENT REVIEWS" : "SOCIETY REVIEWS"}</div><h2>What students say</h2></div>
      {rating && <div className="review-summary"><strong>{rating.avg.toFixed(1)}</strong><div><Stars value={rating.avg} size={15}/><span>{rating.count} {rating.count === 1 ? "review" : "reviews"}</span></div></div>}
    </div>

    {signedIn ? <form className="review-form" onSubmit={submit}>
      <div className="review-form-head"><strong>{mine ? `Edit your ${label} review` : `Review this ${label}`}</strong>
        <div className="star-picker" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={stars === n}
            onMouseEnter={() => setHover(n)} onClick={() => setStars(n)}>
            <Star size={22} className={n <= (hover || stars) ? "star on" : "star"} fill={n <= (hover || stars) ? "currentColor" : "none"}/>
          </button>)}
        </div>
      </div>
      <textarea rows={3} maxLength={800} value={text} onChange={(e) => setText(e.target.value)} placeholder={`How was ${targetName}? (optional)`} aria-label="Your review"/>
      <div className="review-form-foot"><small>{text.length}/800 · One review per {label}. Posting again edits it.</small><button className="primary-button" disabled={busy}>{busy ? "Saving…" : mine ? "Update review" : "Post review"}</button></div>
    </form> : <div className="review-signin"><Link href={`/signin?next=${encodeURIComponent(nextPath)}`}>Sign in</Link> to rate and review this {label}.</div>}

    {reviews.length === 0 ? <div className="empty-state"><Star size={22}/><strong>No reviews yet</strong><p>Be the first to share what it was like.</p></div> :
      <ul className="review-list">{reviews.map((r) => <li key={r.id} className="review-item">
        <div className="review-avatar">{r.name.charAt(0).toUpperCase()}</div>
        <div className="review-body">
          <div className="review-meta"><strong>{r.name}</strong>{r.verified && <span className="verified-badge"><BadgeCheck size={13}/>{targetType === "event" ? "Attended" : "Member"}</span>}<span className="review-date">{shortDate(r.createdAt)}</span>
            {r.mine && <button className="icon-link" onClick={() => remove(r.id)} aria-label="Delete your review"><Trash2 size={13}/></button>}</div>
          <Stars value={r.rating} size={13}/>
          {r.text && <p>{r.text}</p>}
        </div>
      </li>)}</ul>}
    {toast}
  </section>;
}
