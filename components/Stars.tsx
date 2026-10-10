import { Star } from "lucide-react";
import type { Rating } from "@/lib/types";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? "star on" : "star"} fill={n <= Math.round(value) ? "currentColor" : "none"}/>)}
  </span>;
}

export function RatingBadge({ rating, empty = "No reviews yet" }: { rating: Rating; empty?: string }) {
  if (!rating) return <span className="rating-badge muted">{empty}</span>;
  return <span className="rating-badge"><Stars value={rating.avg} size={13}/><strong>{rating.avg.toFixed(1)}</strong><span>({rating.count})</span></span>;
}
