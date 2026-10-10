// All the "read" queries the pages use, in one place.
import db from "./db";
import { nowLocal } from "./format";

// A society's rating = its event reviews + reviews of the society itself.
const ALL_SOCIETY_STARS = `
  SELECT r.stars FROM reviews r JOIN events e ON e.id = r.event_id WHERE e.society_id = s.id
  UNION ALL SELECT sr.stars FROM society_reviews sr WHERE sr.society_id = s.id`;

// Flags only (the pictures themselves are served by /api/societies/[id]/image/[kind]).
export const SOCIETY_MEDIA_FLAGS = `
  EXISTS (SELECT 1 FROM society_media m WHERE m.society_id = s.id AND m.kind = 'avatar') AS has_avatar,
  EXISTS (SELECT 1 FROM society_media m WHERE m.society_id = s.id AND m.kind = 'cover') AS has_cover,
  EXISTS (SELECT 1 FROM society_media m WHERE m.society_id = s.id AND m.kind = 'card') AS has_card_bg,
  (SELECT MAX(m.updated_at) FROM society_media m WHERE m.society_id = s.id) AS media_version`;

const SOCIETY_STATS = `
  (SELECT ROUND(AVG(stars), 2) FROM (${ALL_SOCIETY_STARS})) AS avg_rating,
  (SELECT COUNT(*) FROM (${ALL_SOCIETY_STARS})) AS review_count,
  ${SOCIETY_MEDIA_FLAGS},
  (SELECT COUNT(*) FROM events e WHERE e.society_id = s.id AND e.start >= ?) AS upcoming_count,
  (SELECT COUNT(*) FROM payments p WHERE p.society_id = s.id AND p.kind = 'membership') AS member_count,
  EXISTS (SELECT 1 FROM follows f WHERE f.society_id = s.id AND f.user_id = ?) AS is_following,
  EXISTS (SELECT 1 FROM payments p WHERE p.society_id = s.id AND p.user_id = ? AND p.kind = 'membership') AS is_member
`;

export function listSocieties({ search = "", category = "", userId }) {
  return db
    .prepare(
      `SELECT s.*, ${SOCIETY_STATS}
       FROM societies s
       WHERE s.status = 'approved'
         AND (? = '' OR s.name LIKE '%' || ? || '%' OR s.description LIKE '%' || ? || '%')
         AND (? = '' OR s.category = ?)
       ORDER BY s.name`
    )
    .all(nowLocal(), userId, userId, search, search, search, category, category);
}

export function getSociety(id, userId) {
  return db.prepare(`SELECT s.*, ${SOCIETY_STATS} FROM societies s WHERE s.id = ? AND s.status = 'approved'`).get(nowLocal(), userId, userId, id);
}

// Events for the calendar. `followedBy` limits to societies that user follows.
export function listEvents({ search = "", category = "", followedBy = null, societyId = null } = {}) {
  return db
    .prepare(
      `SELECT e.*, s.name AS society_name, s.category,
         (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS going, -- tickets also create an RSVP
         EXISTS (SELECT 1 FROM event_posters ep WHERE ep.event_id = e.id) AS has_poster,
         EXISTS (SELECT 1 FROM society_media m WHERE m.society_id = s.id AND m.kind = 'avatar') AS society_has_avatar,
         (SELECT MAX(m.updated_at) FROM society_media m WHERE m.society_id = s.id) AS society_media_version
       FROM events e JOIN societies s ON s.id = e.society_id
       WHERE s.status = 'approved'
         AND (? = '' OR e.title LIKE '%' || ? || '%' OR s.name LIKE '%' || ? || '%' OR e.description LIKE '%' || ? || '%')
         AND (? = '' OR s.category = ?)
         AND (? IS NULL OR e.society_id IN (SELECT society_id FROM follows WHERE user_id = ?))
         AND (? IS NULL OR e.society_id = ?)
       ORDER BY e.start`
    )
    .all(search, search, search, search, category, category, followedBy, followedBy, societyId, societyId);
}

export function getEvent(id, userId) {
  return db
    .prepare(
      `SELECT e.*, s.name AS society_name, s.category, s.stripe_account_id,
         EXISTS (SELECT 1 FROM event_posters ep WHERE ep.event_id = e.id) AS has_poster,
         EXISTS (SELECT 1 FROM rsvps WHERE event_id = e.id AND user_id = ?) AS has_rsvp,
         EXISTS (SELECT 1 FROM payments WHERE event_id = e.id AND user_id = ? AND kind = 'ticket') AS has_ticket,
         EXISTS (SELECT 1 FROM reviews WHERE event_id = e.id AND user_id = ?) AS has_review,
         EXISTS (SELECT 1 FROM google_events WHERE event_id = e.id AND user_id = ?) AS in_google,
         (SELECT COUNT(*) FROM payments WHERE event_id = e.id AND kind = 'ticket') AS tickets_sold,
         (SELECT COUNT(*) FROM rsvps WHERE event_id = e.id) AS rsvp_count,
         (SELECT ROUND(AVG(stars), 2) FROM reviews WHERE event_id = e.id) AS avg_rating
       FROM events e JOIN societies s ON s.id = e.society_id
       WHERE e.id = ?`
    )
    .get(userId, userId, userId, userId, id);
}

export function eventReviews(eventId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.event_id = ? ORDER BY r.created_at DESC`
    )
    .all(eventId);
}

export function societyReviews(societyId) {
  return db
    .prepare(
      `SELECT r.*, e.title AS event_title, u.name AS user_name
       FROM reviews r JOIN events e ON e.id = r.event_id JOIN users u ON u.id = r.user_id
       WHERE e.society_id = ? ORDER BY r.created_at DESC`
    )
    .all(societyId);
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
export function societyOwnReviews(societyId) {
  return db
    .prepare(
      `SELECT sr.*, u.name AS user_name,
         EXISTS (SELECT 1 FROM payments p WHERE p.user_id = sr.user_id AND p.society_id = sr.society_id AND p.kind = 'membership') AS is_member,
         EXISTS (SELECT 1 FROM rsvps r JOIN events e ON e.id = r.event_id
                 WHERE r.user_id = sr.user_id AND e.society_id = sr.society_id AND e.start < ?) AS attended
       FROM society_reviews sr JOIN users u ON u.id = sr.user_id
       WHERE sr.society_id = ? ORDER BY sr.updated_at DESC`
    )
    .all(nowLocal(), societyId);
}

// Who may review a society: verified students who are members OR went to one of its events.
// Returns null if allowed, otherwise the reason shown to the student.
export function societyReviewBlockReason(user, societyId) {
  if (!user) return "Log in to review societies.";
  if (user.role !== "student") return "Only students can review societies.";
  if (user.status !== "verified") return "Reviews unlock once the SocSync admin has verified your account.";
  const ok = db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM payments WHERE user_id = ? AND society_id = ? AND kind = 'membership')
           OR EXISTS (SELECT 1 FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? AND e.society_id = ? AND e.start < ?) AS ok`
    )
    .get(user.id, societyId, user.id, societyId, nowLocal()).ok;
  return ok ? null : "Only members, or students who went to one of its events, can review a society.";
}

// ---------- free "reserved" tickets (RSVPs to free events) ----------

export function myReservations(userId) {
  return db
    .prepare(
      `SELECT 'reserved' AS kind, r.user_id, e.id AS event_id, e.title, e.start, e.venue, s.name AS society_name
       FROM rsvps r JOIN events e ON e.id = r.event_id JOIN societies s ON s.id = e.society_id
       WHERE r.user_id = ? AND e.price_cents = 0 ORDER BY e.start`
    )
    .all(userId);
}

// Societies a student is a paid member of OR follows, with their next upcoming event.
export function mySocieties(userId) {
  return db
    .prepare(
      `SELECT s.id, s.name, s.category, s.membership_fee_cents, s.instagram, ${SOCIETY_MEDIA_FLAGS},
         (SELECT COUNT(*) FROM payments pm WHERE pm.society_id = s.id AND pm.kind = 'membership') AS member_count,
         EXISTS (SELECT 1 FROM payments p WHERE p.society_id = s.id AND p.user_id = ? AND p.kind = 'membership') AS is_member,
         (SELECT e.title FROM events e WHERE e.society_id = s.id AND e.start >= ? ORDER BY e.start LIMIT 1) AS next_title,
         (SELECT e.start FROM events e WHERE e.society_id = s.id AND e.start >= ? ORDER BY e.start LIMIT 1) AS next_start,
         (SELECT e.id FROM events e WHERE e.society_id = s.id AND e.start >= ? ORDER BY e.start LIMIT 1) AS next_id
       FROM societies s
       WHERE s.status = 'approved'
         AND (s.id IN (SELECT society_id FROM follows WHERE user_id = ?)
              OR s.id IN (SELECT society_id FROM payments WHERE user_id = ? AND kind = 'membership'))
       ORDER BY is_member DESC, s.name`
    )
    .all(userId, nowLocal(), nowLocal(), nowLocal(), userId, userId);
}

// ---------- "My societies" page ----------

export function myMemberships(userId) {
  return db
    .prepare(
      `SELECT p.id AS payment_id, p.created_at, p.society_id, s.name AS society_name, s.category,
              u.name AS member_name, u.student_number, ${SOCIETY_MEDIA_FLAGS}
       FROM payments p JOIN societies s ON s.id = p.society_id JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ? AND p.kind = 'membership' ORDER BY p.created_at DESC`
    )
    .all(userId);
}

export function myTickets(userId) {
  return db
    .prepare(
      `SELECT p.id AS payment_id, p.stripe_session_id, p.amount_cents, p.event_id,
              e.title, e.start, e.venue, s.name AS society_name
       FROM payments p JOIN events e ON e.id = p.event_id JOIN societies s ON s.id = e.society_id
       WHERE p.user_id = ? AND p.kind = 'ticket' ORDER BY e.start`
    )
    .all(userId);
}

// Upcoming free events the student RSVP'd to (paid ones show up as tickets instead).
export function myUpcomingRsvps(userId) {
  return db
    .prepare(
      `SELECT e.*, s.name AS society_name, s.category,
              (SELECT COUNT(*) FROM rsvps r2 WHERE r2.event_id = e.id) AS going,
              EXISTS (SELECT 1 FROM event_posters ep WHERE ep.event_id = e.id) AS has_poster
       FROM rsvps r JOIN events e ON e.id = r.event_id JOIN societies s ON s.id = e.society_id
       WHERE r.user_id = ? AND e.start >= ? AND e.price_cents = 0 ORDER BY e.start`
    )
    .all(userId, nowLocal());
}

// Paid members of a society (for the society dashboard).
export function societyMembers(societyId) {
  return db
    .prepare(
      `SELECT u.name, u.student_number, p.amount_cents, p.created_at
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.society_id = ? AND p.kind = 'membership' ORDER BY p.created_at DESC`
    )
    .all(societyId);
}

// ---------- verification (SocSync admin) ----------

export function pendingStudents() {
  return db
    .prepare("SELECT id, name, student_number, email, created_at FROM users WHERE role = 'student' AND status = 'pending' ORDER BY created_at")
    .all();
}

export function pendingSocieties() {
  return db
    .prepare(
      `SELECT s.*, u.name AS applicant_name, u.email AS applicant_email, u.student_number AS applicant_number, u.status AS applicant_status
       FROM societies s JOIN users u ON u.id = s.applicant_user_id
       WHERE s.status = 'pending' ORDER BY s.applied_at`
    )
    .all();
}

export function platformStats() {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role IN ('student', 'admin') AND status = 'verified') AS verified_users,
         (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_users,
         (SELECT COUNT(*) FROM societies WHERE status = 'approved') AS live_societies,
         (SELECT COUNT(*) FROM societies WHERE status = 'pending') AS pending_societies`
    )
    .get();
}

// The latest society application by this user (any status), for "your application" messages.
export function myApplication(userId) {
  return db.prepare("SELECT * FROM societies WHERE applicant_user_id = ? ORDER BY applied_at DESC LIMIT 1").get(userId);
}

export function societyDashboard(societyId) {
  const events = db
    .prepare(
      `SELECT e.*,
         (SELECT COUNT(*) FROM rsvps WHERE event_id = e.id) AS rsvp_count,
         (SELECT COUNT(*) FROM payments WHERE event_id = e.id AND kind = 'ticket') AS tickets_sold,
         (SELECT ROUND(AVG(stars), 2) FROM reviews WHERE event_id = e.id) AS avg_rating
       FROM events e WHERE e.society_id = ? ORDER BY e.start DESC`
    )
    .all(societyId);
  const payments = db
    .prepare(
      `SELECT p.*, u.name AS user_name, e.title AS event_title
       FROM payments p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN events e ON e.id = p.event_id
       WHERE p.society_id = ? ORDER BY p.created_at DESC`
    )
    .all(societyId);
  return { events, payments };
}
