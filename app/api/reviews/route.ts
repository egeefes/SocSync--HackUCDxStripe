import { NextResponse } from "next/server";
import { fail, readJson, requireUser, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";
import { findEvent, findSociety, newId } from "@/lib/domain";

function targetExists(db: Parameters<typeof findEvent>[0], type: string, id: string) {
  if (type === "event") return !!findEvent(db, Number(id));
  if (type === "society") return !!findSociety(id);
  return false;
}

// One review per student per event / per society. Posting again edits the existing review.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const targetType = body.targetType as "event" | "society";
    const targetId = String(body.targetId ?? "");
    const rating = Number(body.rating);
    const text = String(body.text ?? "").trim().slice(0, 800);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Choose a rating from 1 to 5 stars.");
    await mutate((db) => {
      const user = requireUser(db);
      if (!targetExists(db, targetType, targetId)) throw new HttpError(404, "Nothing to review here.");
      const now = new Date().toISOString();
      const existing = db.reviews.find((r) => r.userId === user.id && r.targetType === targetType && r.targetId === targetId);
      if (existing) Object.assign(existing, { rating, text, updatedAt: now });
      else db.reviews.push({ id: newId(), targetType, targetId, userId: user.id, rating, text, createdAt: now, updatedAt: now });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function DELETE(request: Request) {
  try {
    const { reviewId } = await readJson(request);
    await mutate((db) => {
      const user = requireUser(db);
      const i = db.reviews.findIndex((r) => r.id === reviewId && r.userId === user.id);
      if (i < 0) throw new HttpError(404, "Review not found.");
      db.reviews.splice(i, 1);
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
