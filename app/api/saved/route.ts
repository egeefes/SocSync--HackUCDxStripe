import { NextResponse } from "next/server";
import { fail, readJson, requireUser, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";
import { findEvent } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const { eventId } = await readJson(request);
    const id = Number(eventId);
    const saved = await mutate((db) => {
      const user = requireUser(db);
      if (!findEvent(db, id)) throw new HttpError(404, "Event not found.");
      user.saved = user.saved.includes(id) ? user.saved.filter((x) => x !== id) : [...user.saved, id];
      return user.saved;
    });
    return NextResponse.json({ ok: true, saved });
  } catch (e) { return fail(e); }
}
