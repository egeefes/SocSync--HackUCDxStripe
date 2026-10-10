// All the "read" queries the pages use, in one place.
// Data comes from Upstash Redis (lib/db.js). Redis has no joins, so each query loads the few small
// tables it needs in ONE round trip (db.load) and joins / filters / sorts them here in JavaScript.
// Every function is async: always `await` it.
import db from "./db";
import { nowLocal } from "./format";

// ---------- small helpers ----------
const round2 = (n) => Math.round(n * 100) / 100;
const avg = (rows) => (rows.length ? round2(rows.reduce((s, r) => s + r.stars, 0) / rows.length) : null);
const index = (rows, key = "id") => new Map(rows.map((r) => [r[key], r]));
const flag = (b) => (b ? 1 : 0);
const has = (hay, needle) => String(hay ?? "").toLowerCase().includes(needle.toLowerCase());
// Sort helpers: by one text/number field, then by id so the order is always stable.
const asc = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : (a.id ?? 0) - (b.id ?? 0));
const desc = (key) => (a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : (b.id ?? 0) - (a.id ?? 0));

// Society pictures are stored as { society_id, kind, updated_at } here (the image data itself is separate).
function mediaFlags(societyId, media) {
  const mine = media.filter((m) => m.society_id === societyId);
  const kinds = new Set(mine.map((m) => m.kind));
  return {
    has_avatar: flag(kinds.has("avatar")),
    has_cover: flag(kinds.has("cover")),
    has_card_bg: flag(kinds.has("card")),
    media_version: mine.reduce((max, m) => (m.updated_at > max ? m.updated_at : max), "") || null,
  };
}

// Flags only (the pictures themselves are served by /api/societies/[id]/image/[kind]).
export async function societyMediaFlags(societyId) {
  const media = await db.all("society_media_meta");
  return mediaFlags(Number(societyId), media);
}

// A society row plus its ratings, counts and "is this user following / a member?" flags.
function societyStats(s, d, userId, now) {
  const eventIds = new Set(d.events.filter((e) => e.society_id === s.id).map((e) => e.id));
  const stars = [
    ...d.reviews.filter((r) => eventIds.has(r.event_id)),
    ...d.society_reviews.filter((r) => r.society_id === s.id),
  ];
  const memberships = d.payments.filter((p) => p.society_id === s.id && p.kind === "membership");
  return {
    ...s,
    avg_rating: avg(stars),
    review_count: stars.length,
    ...mediaFlags(s.id, d.society_media_meta),
    upcoming_count: d.events.filter((e) => e.society_id === s.id && e.start >= now).length,
    member_count: memberships.length,
    is_following: flag(d.follows.some((f) => f.society_id === s.id && f.user_id === userId)),
    is_member: flag(memberships.some((p) => p.user_id === userId)),
  };
}

const SOCIETY_TABLES = ["societies", "events", "reviews", "society_reviews", "payments", "follows", "society_media_meta"];

export async function listSocieties({ search = "", category = "", userId }) {
  const d = await db.load(SOCIETY_TABLES);
  const now = nowLocal();
  return d.societies
    .filter((s) => s.status === "approved")
    .filter((s) => !search || has(s.name, search) || has(s.description, search))
    .filter((s) => !category || s.category === category)
    .sort(asc("name"))
    .map((s) => societyStats(s, d, userId, now));
}

export async function getSociety(id, userId) {
  const d = await db.load(SOCIETY_TABLES);
  const s = d.societies.find((x) => x.id === id && x.status === "approved");
  return s ? societyStats(s, d, userId, nowLocal()) : undefined;
}

// A society's own row with picture flags (society admin dashboard).
export async function getSocietyWithMedia(id) {
  const [s, flags] = await Promise.all([db.get("societies", id), societyMediaFlags(id)]);
  return s ? { ...s, ...flags } : undefined;
}

// Events for the calendar. `followedBy` limits to societies that user follows.
export async function listEvents({ search = "", category = "", followedBy = null, societyId = null } = {}) {
  const [d, posterIds] = await Promise.all([
    db.load(["events", "societies", "rsvps", "follows", "society_media_meta"]),
    db.fields("event_posters"),
  ]);
  const societies = index(d.societies);
  const posters = new Set(posterIds.map(Number));
  const followed = followedBy == null ? null : new Set(d.follows.filter((f) => f.user_id === followedBy).map((f) => f.society_id));
  const going = new Map();
  for (const r of d.rsvps) going.set(r.event_id, (going.get(r.event_id) ?? 0) + 1);

  return d.events
    .map((e) => ({ e, s: societies.get(e.society_id) }))
    .filter(({ s }) => s && s.status === "approved")
    .filter(({ e, s }) => !search || has(e.title, search) || has(s.name, search) || has(e.description, search))
    .filter(({ s }) => !category || s.category === category)
    .filter(({ e }) => !followed || followed.has(e.society_id))
    .filter(({ e }) => societyId == null || e.society_id === societyId)
    .sort((a, b) => asc("start")(a.e, b.e))
    .map(({ e, s }) => {
      const m = mediaFlags(s.id, d.society_media_meta);
      return {
        ...e,
        society_name: s.name,
        category: s.category,
        going: going.get(e.id) ?? 0, // tickets also create an RSVP
        has_poster: flag(posters.has(e.id)),
        society_has_avatar: m.has_avatar,
        society_media_version: m.media_version,
      };
    });
}

export async function getEvent(id, userId) {
  const e = await db.get("events", id);
  if (!e) return undefined;
  const [s, d, hasPoster] = await Promise.all([
    db.get("societies", e.society_id),
    db.load(["rsvps", "payments", "reviews", "google_events"]),
    db.has("event_posters", id),
  ]);
  if (!s) return undefined;
  const reviews = d.reviews.filter((r) => r.event_id === id);
  const tickets = d.payments.filter((p) => p.event_id === id && p.kind === "ticket");
  return {
    ...e,
    society_name: s.name,
    category: s.category,
    stripe_account_id: s.stripe_account_id,
    has_poster: flag(hasPoster),
    has_rsvp: flag(d.rsvps.some((r) => r.event_id === id && r.user_id === userId)),
    has_ticket: flag(tickets.some((p) => p.user_id === userId)),
    has_review: flag(reviews.some((r) => r.user_id === userId)),
    in_google: flag(d.google_events.some((g) => g.event_id === id && g.user_id === userId)),
    tickets_sold: tickets.length,
    rsvp_count: d.rsvps.filter((r) => r.event_id === id).length,
    avg_rating: avg(reviews),
  };
}

export async function eventReviews(eventId) {
  const reviews = (await db.all("reviews")).filter((r) => r.event_id === eventId);
  const users = index(await db.getMany("users", [...new Set(reviews.map((r) => r.user_id))]));
  return reviews
    .filter((r) => users.has(r.user_id))
    .map((r) => ({ ...r, user_name: users.get(r.user_id).name }))
    .sort(desc("created_at"));
}

export async function societyReviews(societyId) {
  const d = await db.load(["reviews", "events"]);
  const events = index(d.events.filter((e) => e.society_id === societyId));
  const reviews = d.reviews.filter((r) => events.has(r.event_id));
  const users = index(await db.getMany("users", [...new Set(reviews.map((r) => r.user_id))]));
  return reviews
    .filter((r) => users.has(r.user_id))
    .map((r) => ({ ...r, event_title: events.get(r.event_id).title, user_name: users.get(r.user_id).name }))
    .sort(desc("created_at"));
}

// Rules for who may review an event. Returns null if allowed, otherwise the reason.
export function reviewBlockReason(event, user) {
  if (!event) return "Event not found.";
  if (!user) return "Log in to review events you attended.";
  if (user.status !== "verified") return "Reviews unlock once the SocSync admin has verified your account.";
  if (user.role !== "student") return "Only students can leave reviews.";
  if (event.start > nowLocal()) return "You can review this event after it has started.";
  if (!event.has_rsvp && !event.has_ticket) return "Only students who RSVP'd or bought a ticket can review.";
  if (event.has_review) return "You have already reviewed this event.";
  return null;
}

// ---------- reviews of a society as a whole ----------

// Each review says whether the writer is a paid member and/or attended one of its events.
export async function societyOwnReviews(societyId) {
  const d = await db.load(["society_reviews", "payments", "rsvps", "events"]);
  const now = nowLocal();
  const pastEvents = new Set(d.events.filter((e) => e.society_id === societyId && e.start < now).map((e) => e.id));
  const reviews = d.society_reviews.filter((r) => r.society_id === societyId);
  const users = index(await db.getMany("users", [...new Set(reviews.map((r) => r.user_id))]));
  return reviews
    .filter((r) => users.has(r.user_id))
    .map((r) => ({
      ...r,
      user_name: users.get(r.user_id).name,
      is_member: flag(d.payments.some((p) => p.user_id === r.user_id && p.society_id === societyId && p.kind === "membership")),
      attended: flag(d.rsvps.some((x) => x.user_id === r.user_id && pastEvents.has(x.event_id))),
    }))
    .sort(desc("updated_at"));
}

// Who may review a society: verified students who are members OR went to one of its events.
// Returns null if allowed, otherwise the reason shown to the student.
export async function societyReviewBlockReason(user, societyId) {
  if (!user) return "Log in to review societies.";
  if (user.role !== "student") return "Only students can review societies.";
  if (user.status !== "verified") return "Reviews unlock once the SocSync admin has verified your account.";
  const d = await db.load(["payments", "rsvps", "events"]);
  const now = nowLocal();
  const member = d.payments.some((p) => p.user_id === user.id && p.society_id === societyId && p.kind === "membership");
  const pastEvents = new Set(d.events.filter((e) => e.society_id === societyId && e.start < now).map((e) => e.id));
  const attended = d.rsvps.some((r) => r.user_id === user.id && pastEvents.has(r.event_id));
  return member || attended ? null : "Only members, or students who went to one of its events, can review a society.";
}

// ---------- free "reserved" tickets (RSVPs to free events) ----------

export async function myReservations(userId) {
  const d = await db.load(["rsvps", "events", "societies"]);
  const events = index(d.events);
  const societies = index(d.societies);
  return d.rsvps
    .filter((r) => r.user_id === userId)
    .map((r) => events.get(r.event_id))
    .filter((e) => e && e.price_cents === 0 && societies.has(e.society_id))
    .sort(asc("start"))
    .map((e) => ({
      kind: "reserved", user_id: userId, event_id: e.id, title: e.title, start: e.start, venue: e.venue,
      society_name: societies.get(e.society_id).name,
    }));
}

// Societies a student is a paid member of OR follows, with their next upcoming event.
export async function mySocieties(userId) {
  const d = await db.load(["societies", "events", "payments", "follows", "society_media_meta"]);
  const now = nowLocal();
  const memberOf = new Set(d.payments.filter((p) => p.user_id === userId && p.kind === "membership").map((p) => p.society_id));
  const following = new Set(d.follows.filter((f) => f.user_id === userId).map((f) => f.society_id));
  return d.societies
    .filter((s) => s.status === "approved" && (following.has(s.id) || memberOf.has(s.id)))
    .map((s) => {
      const next = d.events.filter((e) => e.society_id === s.id && e.start >= now).sort(asc("start"))[0];
      return {
        id: s.id, name: s.name, category: s.category, membership_fee_cents: s.membership_fee_cents, instagram: s.instagram,
        ...mediaFlags(s.id, d.society_media_meta),
        member_count: d.payments.filter((p) => p.society_id === s.id && p.kind === "membership").length,
        is_member: flag(memberOf.has(s.id)),
        next_title: next?.title ?? null,
        next_start: next?.start ?? null,
        next_id: next?.id ?? null,
      };
    })
    .sort((a, b) => b.is_member - a.is_member || (a.name < b.name ? -1 : 1));
}

// ---------- "My societies" page ----------

export async function myMemberships(userId) {
  const d = await db.load(["payments", "societies", "society_media_meta"]);
  const societies = index(d.societies);
  const user = await db.get("users", userId);
  if (!user) return [];
  return d.payments
    .filter((p) => p.user_id === userId && p.kind === "membership" && societies.has(p.society_id))
    .sort(desc("created_at"))
    .map((p) => {
      const s = societies.get(p.society_id);
      return {
        payment_id: p.id, created_at: p.created_at, society_id: p.society_id, society_name: s.name, category: s.category,
        member_name: user.name, student_number: user.student_number, ...mediaFlags(s.id, d.society_media_meta),
      };
    });
}

export async function myTickets(userId) {
  const d = await db.load(["payments", "events", "societies"]);
  const events = index(d.events);
  const societies = index(d.societies);
  return d.payments
    .filter((p) => p.user_id === userId && p.kind === "ticket" && events.has(p.event_id))
    .map((p) => ({ p, e: events.get(p.event_id) }))
    .filter(({ e }) => societies.has(e.society_id))
    .sort((a, b) => asc("start")(a.e, b.e))
    .map(({ p, e }) => ({
      payment_id: p.id, stripe_session_id: p.stripe_session_id, amount_cents: p.amount_cents, event_id: e.id,
      title: e.title, start: e.start, venue: e.venue, society_name: societies.get(e.society_id).name,
    }));
}

// Upcoming free events the student RSVP'd to (paid ones show up as tickets instead).
export async function myUpcomingRsvps(userId) {
  const mine = new Set((await db.all("rsvps")).filter((r) => r.user_id === userId).map((r) => r.event_id));
  const now = nowLocal();
  return (await listEvents()).filter((e) => mine.has(e.id) && e.start >= now && e.price_cents === 0);
}

// Paid members of a society (for the society dashboard).
export async function societyMembers(societyId) {
  const payments = (await db.all("payments")).filter((p) => p.society_id === societyId && p.kind === "membership");
  const users = index(await db.getMany("users", [...new Set(payments.map((p) => p.user_id))]));
  return payments
    .filter((p) => users.has(p.user_id))
    .sort(desc("created_at"))
    .map((p) => ({ name: users.get(p.user_id).name, student_number: users.get(p.user_id).student_number, amount_cents: p.amount_cents, created_at: p.created_at }));
}

// ---------- verification (SocSync admin) ----------

export async function pendingStudents() {
  return (await db.all("users"))
    .filter((u) => u.role === "student" && u.status === "pending")
    .sort(asc("created_at"))
    .map((u) => ({ id: u.id, name: u.name, student_number: u.student_number, email: u.email, created_at: u.created_at }));
}

export async function pendingSocieties() {
  const [societies, users] = await Promise.all([db.all("societies"), db.all("users")]);
  const byId = index(users);
  return societies
    .filter((s) => s.status === "pending" && byId.has(s.applicant_user_id))
    .sort(asc("applied_at"))
    .map((s) => {
      const u = byId.get(s.applicant_user_id);
      return { ...s, applicant_name: u.name, applicant_email: u.email, applicant_number: u.student_number, applicant_status: u.status };
    });
}

export async function platformStats() {
  const { users, societies } = await db.load(["users", "societies"]);
  return {
    verified_users: users.filter((u) => ["student", "admin"].includes(u.role) && u.status === "verified").length,
    pending_users: users.filter((u) => u.status === "pending").length,
    live_societies: societies.filter((s) => s.status === "approved").length,
    pending_societies: societies.filter((s) => s.status === "pending").length,
  };
}

// The latest society application by this user (any status), for "your application" messages.
export async function myApplication(userId) {
  return (await db.all("societies")).filter((s) => s.applicant_user_id === userId).sort(desc("applied_at"))[0];
}

export async function societyDashboard(societyId) {
  const d = await db.load(["events", "rsvps", "payments", "reviews"]);
  const events = d.events
    .filter((e) => e.society_id === societyId)
    .sort(desc("start"))
    .map((e) => ({
      ...e,
      rsvp_count: d.rsvps.filter((r) => r.event_id === e.id).length,
      tickets_sold: d.payments.filter((p) => p.event_id === e.id && p.kind === "ticket").length,
      avg_rating: avg(d.reviews.filter((r) => r.event_id === e.id)),
    }));
  const rows = d.payments.filter((p) => p.society_id === societyId).sort(desc("created_at"));
  const users = index(await db.getMany("users", [...new Set(rows.map((p) => p.user_id).filter(Boolean))]));
  const eventsById = index(d.events);
  const payments = rows.map((p) => ({
    ...p,
    user_name: users.get(p.user_id)?.name ?? null,
    event_title: eventsById.get(p.event_id)?.title ?? null,
  }));
  return { events, payments };
}
