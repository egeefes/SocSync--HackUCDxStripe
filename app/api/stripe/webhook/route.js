// Optional backup to /api/stripe/confirm: Stripe calls this server-to-server when a checkout completes,
// so the purchase is recorded even if the student closes the tab before the redirect.
// Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the
// printed whsec_... secret in STRIPE_WEBHOOK_SECRET.
import db from "@/lib/db";
import { stripe, fulfilCheckout } from "@/lib/stripe";

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook not configured." }, { status: 501 });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature"), secret);
  } catch (err) {
    return Response.json({ error: `Bad signature: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await fulfilCheckout(event.data.object);
  }
  if (event.type === "customer.subscription.deleted") {
    // Pro subscription cancelled -> back to the free plan.
    const societies = (await db.all("societies")).filter((s) => s.stripe_subscription_id === event.data.object.id);
    await Promise.all(societies.map((s) => db.update("societies", s.id, { plan: "free" })));
  }
  return Response.json({ received: true });
}
