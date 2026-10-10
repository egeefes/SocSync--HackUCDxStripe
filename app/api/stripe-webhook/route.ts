import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillCheckoutSession } from "@/lib/domain";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  const stripe = new Stripe(secretKey);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      const result = await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session);
      console.log("Checkout session processed:", { id: (event.data.object as Stripe.Checkout.Session).id, ok: result.ok });
    } catch (e) {
      console.error("Fulfilment failed:", e);
      return NextResponse.json({ error: "Fulfilment failed." }, { status: 500 }); // Stripe will retry
    }
  }
  return NextResponse.json({ received: true });
}
