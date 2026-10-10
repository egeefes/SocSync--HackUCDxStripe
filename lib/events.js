// Shared rules for creating and editing events (used by POST /api/events and PATCH /api/events/[id]).
import { nowLocal } from "./format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const REPEATS = { none: 0, weekly: 7, fortnightly: 14, monthly: "month" };

// Returns { errors: [...], values: { title, description, venue, start, end, price, capacity } }.
export function validateEvent(b) {
  const errors = [];
  const title = String(b.title ?? "").trim();
  if (title.length < 3) errors.push("Title must be at least 3 characters.");
  if (title.length > 120) errors.push("Title must be under 120 characters.");
  if (!DATE_RE.test(b.start ?? "")) errors.push("Start date/time is required.");
  if (b.end && !DATE_RE.test(b.end)) errors.push("End date/time is invalid.");
  if (b.end && b.start && b.end <= b.start) errors.push("End must be after start.");
  if (b.start && b.start < nowLocal()) errors.push("Start is in the past.");
  const price = Math.round(Number(b.price_eur || 0) * 100);
  if (!Number.isFinite(price) || price < 0) errors.push("Price must be 0 or more.");
  if (price > 0 && price < 50) errors.push("Paid events must cost at least €0.50 (Stripe minimum).");
  const capacity = b.capacity === "" || b.capacity == null ? null : Number(b.capacity);
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) errors.push("Capacity must be a whole number ≥ 1, or empty.");
  return {
    errors,
    values: {
      title,
      description: String(b.description ?? "").trim(),
      venue: String(b.venue ?? "").trim() || "TBC",
      start: b.start,
      end: b.end || null,
      price,
      capacity,
    },
  };
}

// Shift a 'YYYY-MM-DDTHH:mm' local time by n repeats (weekly / fortnightly / monthly).
export function shiftLocal(local, repeat, n) {
  if (!local || !n) return local;
  const d = new Date(local);
  if (REPEATS[repeat] === "month") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + REPEATS[repeat] * n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
