import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { DB, User } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.message.includes("SESSION_SECRET")) {
    return NextResponse.json({ error: "Server is missing SESSION_SECRET." }, { status: 503 });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function readJson(request: Request): Promise<any> {
  try { return await request.json(); } catch { throw new HttpError(400, "Invalid request body."); }
}

export function requireUser(db: DB): User {
  const s = getSession();
  const u = s ? db.users[s.uid] : undefined;
  if (!u) throw new HttpError(401, "Please sign in first.");
  return u;
}

export function requireCommittee(db: DB): { user: User; societyId: string } {
  const s = getSession();
  const user = requireUser(db);
  if (!s?.committeeOf) throw new HttpError(403, "Committee access required.");
  return { user, societyId: s.committeeOf };
}
