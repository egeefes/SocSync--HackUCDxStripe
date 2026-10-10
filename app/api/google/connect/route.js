// "Connect Google Calendar": send the student to Google's consent screen.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { authUrl, googleConfigured } from "@/lib/google";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const back = (q) => Response.redirect(new URL(`/?google=${q}`, origin), 303);
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL("/login", origin), 303);
  if (user.role !== "student") return back("students-only");
  if (!googleConfigured()) return back("not-configured");

  // Random "state" protects against someone tricking a student into connecting THEIR calendar.
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set("google_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return Response.redirect(authUrl({ origin, state, loginHint: user.email }), 303);
}
