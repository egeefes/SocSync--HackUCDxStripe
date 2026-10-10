// Star rating display (CampusLoop design).
import { Star } from "lucide-react";

export function Stars({ value, size = 14 }) {
  return (
    <span className="stars" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? "star on" : "star"} fill={n <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export function RatingBadge({ avg, count, empty = "No reviews yet" }) {
  if (avg == null) return <span className="rating-badge muted">{empty}</span>;
  return (
    <span className="rating-badge">
      <Stars value={avg} size={13} /><strong>{Number(avg).toFixed(1)}</strong>{count != null && <span>({count})</span>}
    </span>
  );
}
