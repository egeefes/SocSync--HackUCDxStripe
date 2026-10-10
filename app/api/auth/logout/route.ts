import { NextResponse } from "next/server";
import { COOKIE, cookieOptionsFor } from "@/lib/session";

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...cookieOptionsFor(request), maxAge: 0 });
  return res;
}
