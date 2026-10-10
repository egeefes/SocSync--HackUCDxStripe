// Google sends the student back here after the consent screen.
import { cookies } from "next/headers";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { exchangeCode, rememberAccessToken, syncAll } from "@/lib/google";

export async function GET(request) {
  const url = new URL(request.url);
  const back = (q) => Response.redirect(new URL(`/?${q}`, url.origin), 303);
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL("/login", url.origin), 303);

  const store = await cookies();
  const expected = store.get("google_state")?.value;
  store.delete("google_state");

  // The student said no, or their organisation (e.g. a university admin) blocks the app.
  const error = url.searchParams.get("error");
  if (error) return back(`google=error&reason=${encodeURIComponent(error)}`);
  if (!expected || url.searchParams.get("state") !== expected) return back("google=error&reason=state_mismatch");

  try {
    const { refreshToken, accessToken, expiresIn, email } = await exchangeCode(url.searchParams.get("code"), url.origin);
    if (!refreshToken) return back("google=error&reason=no_refresh_token");
    db.prepare("UPDATE users SET google_refresh_token = ?, google_email = ? WHERE id = ?").run(refreshToken, email, user.id);
    rememberAccessToken(user.id, accessToken, expiresIn);
    const counts = await syncAll(user.id); // put everything they're already going to into the calendar
    return back(`google=connected&added=${counts.added}`);
  } catch (err) {
    console.error("[google callback]", err.message);
    return back(`google=error&reason=${encodeURIComponent(err.message.slice(0, 80))}`);
  }
}
