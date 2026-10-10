import { cache } from "react";
import crypto from "crypto";
import type Stripe from "stripe";
import { readDb, mutate } from "./store";
import { getSession } from "./session";
import { seedEvents, societies } from "./data";
import { nowDublin, parts } from "./format";
import type { DB, EventItem, EventView, Rating, ReviewView, Society, SocietyView, User } from "./types";

export const getDb = cache(readDb);
export const newId = () => crypto.randomBytes(8).toString("hex");
export const newCode = () => "CL-" + crypto.randomBytes(5).toString("hex").toUpperCase();

export const allEvents = (db: DB): EventItem[] => [...seedEvents, ...db.events];
export const findEvent = (db: DB, id: number) => allEvents(db).find((e) => e.id === id);
export const findSociety = (id: string) => societies.find((s) => s.id === id);
export const allSocieties = () => societies;

export function ratingOf(db: DB, targetType: "event" | "society", targetId: string): Rating {
  const rs = db.reviews.filter((r) => r.targetType === targetType && r.targetId === targetId);
  if (!rs.length) return null;
  return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length };
}

export function goingCount(db: DB, e: EventItem) {
  return e.baseGoing + db.tickets.filter((t) => t.eventId === e.id).length;
}

export function eventView(db: DB, e: EventItem): EventView {
  const going = goingCount(db, e);
  const p = parts(e.startsAt);
  return {
    ...e, societyName: findSociety(e.societyId)?.name ?? "Society", societyAvatar: db.societyProfiles?.[e.societyId]?.avatar || undefined, going,
    spotsLeft: Math.max(0, e.capacity - going), day: p.day, date: p.date, time: p.time,
    rating: ratingOf(db, "event", String(e.id)),
  };
}

export function societyView(db: DB, s: Society, uid?: string): SocietyView {
  const mine = uid ? db.memberships.find((m) => m.societyId === s.id && m.userId === uid) : undefined;
  const profile = db.societyProfiles?.[s.id] ?? {};
  return {
    ...s, ...profile,
    image: profile.image || s.image,
    bio: profile.bio || s.bio,
    tagline: profile.tagline || s.tagline,
    committee: profile.committee ?? s.committee,
    socials: profile.socials ?? s.socials,
    memberCount: s.baseMembers + db.memberships.filter((m) => m.societyId === s.id && m.status === "confirmed").length,
    rating: ratingOf(db, "society", s.id), status: mine?.status ?? null,
  };
}

export function reviewsFor(db: DB, targetType: "event" | "society", targetId: string, uid?: string): ReviewView[] {
  return db.reviews
    .filter((r) => r.targetType === targetType && r.targetId === targetId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => {
      const verified = targetType === "event"
        ? db.tickets.some((t) => t.userId === r.userId && t.eventId === Number(targetId))
        : db.memberships.some((m) => m.userId === r.userId && m.societyId === targetId && m.status === "confirmed");
      return {
        id: r.id, rating: r.rating, text: r.text, name: db.users[r.userId]?.name ?? "Student",
        verified, createdAt: r.updatedAt, mine: r.userId === uid,
      };
    });
}

export async function getCurrentUser() {
  const db = await getDb();
  const s = getSession();
  const user: User | null = s ? db.users[s.uid] ?? null : null;
  const committeeOf = user && s?.committeeOf ? findSociety(s.committeeOf) ?? null : null;
  return { db, user, committeeOf };
}

/** Deterministic, interest-based picks. Explains each pick, never invents data. */
export function recommend(db: DB, user: User) {
  const interests = new Set(user.interests.map((i) => i.toLowerCase()));
  const now = nowDublin();
  const have = new Set(db.tickets.filter((t) => t.userId === user.id).map((t) => t.eventId));
  const events = allEvents(db)
    .filter((e) => e.startsAt >= now && !have.has(e.id))
    .map((e) => {
      const catHit = interests.has(e.category.toLowerCase());
      const tagHits = e.tags.filter((t) => [...interests].some((i) => t.toLowerCase().includes(i) || i.includes(t.toLowerCase()))).length;
      return { id: e.id, score: (catHit ? 3 : 0) + tagHits, reason: `Matches your interest in ${e.category}` };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const joined = new Set(db.memberships.filter((m) => m.userId === user.id).map((m) => m.societyId));
  const socs = societies
    .filter((s) => !joined.has(s.id) && interests.has(s.category.toLowerCase()))
    .slice(0, 4)
    .map((s) => ({ id: s.id, reason: `Matches your interest in ${s.category}` }));
  return { events, societies: socs };
}

/**
 * Records a verified, paid Checkout Session. Idempotent: safe to call from both the
 * webhook and the success page, and safe if Stripe redelivers the webhook.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return { ok: false as const };
  const { kind, targetId, userId } = session.metadata ?? {};
  if (!kind || !targetId || !userId) return { ok: false as const };
  return mutate((db) => {
    if (!db.users[userId]) return { ok: false as const };
    const now = new Date().toISOString();
    if (kind === "ticket") {
      const eventId = Number(targetId);
      const dup = db.tickets.some((t) => t.sessionId === session.id || (t.userId === userId && t.eventId === eventId));
      if (!dup) db.tickets.push({ id: newId(), eventId, userId, kind: "paid", sessionId: session.id, code: newCode(), createdAt: now });
    } else if (kind === "membership") {
      const dup = db.memberships.some((m) => m.sessionId === session.id || (m.userId === userId && m.societyId === targetId));
      if (!dup) db.memberships.push({ id: newId(), societyId: targetId, userId, status: "pending", sessionId: session.id, paidAt: now });
    } else return { ok: false as const };
    return { ok: true as const, kind, targetId };
  });
}
