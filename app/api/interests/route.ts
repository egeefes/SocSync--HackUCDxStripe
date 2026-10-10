import { NextResponse } from "next/server";
import { INTERESTS } from "@/lib/data";
import { fail, readJson, requireUser } from "@/lib/http";
import { mutate } from "@/lib/store";
import { HttpError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { interests } = await readJson(request);
    if (!Array.isArray(interests)) throw new HttpError(400, "Choose at least one interest.");
    const clean = Array.from(new Set(interests.map(String))).filter((i) => INTERESTS.includes(i));
    await mutate((db) => { requireUser(db).interests = clean; });
    return NextResponse.json({ ok: true, interests: clean });
  } catch (e) { return fail(e); }
}
