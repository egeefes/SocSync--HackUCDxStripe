// Stripe redirects here after a successful checkout. We ask Stripe directly whether the session
// was paid (never trust the URL alone), record it, then send the user back to the right page.
import { stripe, fulfilCheckout } from "@/lib/stripe";
import { syncEventQuietly } from "@/lib/google";

export async function GET(request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const back = (path) => Response.redirect(new URL(path, url.origin), 303);
  if (!sessionId) return back("/?checkout=missing");

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const result = await fulfilCheckout(session);
    if (!result.ok) return back(`/?checkout=failed`);
    if (result.kind === "pro") return back("/admin?checkout=pro");
    if (result.kind === "ticket") {
      await syncEventQuietly(result.userId, result.eventId); // ticket -> event in their Google Calendar
      return back(`/events/${result.eventId}?checkout=ticket`);
    }
    return back(`/societies/${result.societyId}?checkout=membership`);
  } catch (err) {
    console.error("[stripe confirm]", err);
    return back("/?checkout=error");
  }
}
