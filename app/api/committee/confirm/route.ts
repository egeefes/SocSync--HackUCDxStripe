import { NextResponse } from "next/server";
import { fail, readJson, requireCommittee, HttpError } from "@/lib/http";
import { mutate } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { membershipId } = await readJson(request);
    await mutate((db) => {
      const { societyId } = requireCommittee(db);
      const m = db.memberships.find((x) => x.id === membershipId && x.societyId === societyId);
      if (!m) throw new HttpError(404, "Signup not found for your society.");
      if (m.status === "pending") { m.status = "confirmed"; m.confirmedAt = new Date().toISOString(); }
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
