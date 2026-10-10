import Link from "next/link";
import { CheckCircle2, ArrowLeft, Ticket, IdCard } from "lucide-react";
import Stripe from "stripe";
import { fulfillCheckoutSession } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id;
  let verified = false;
  let recorded = false;
  let title = "Your purchase";
  let kind = "ticket";
  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      verified = session.payment_status === "paid";
      title = session.metadata?.title || title;
      kind = session.metadata?.kind || kind;
      // Record the order here as well as in the webhook (idempotent), so it works even before webhooks are set up.
      if (verified) recorded = (await fulfillCheckoutSession(session)).ok;
    } catch { verified = false; }
  }
  const isMembership = kind === "membership";
  return <main className="success-page"><div className="success-card">
    <div className={`success-icon ${verified ? "verified" : ""}`}><CheckCircle2 size={34}/></div>
    <div className="success-eyebrow">{verified ? "PAYMENT CONFIRMED" : "CHECKOUT RETURNED"}</div>
    <h1>{verified ? (isMembership ? "You've joined!" : "You're on the list.") : "Almost there."}</h1>
    <p>{verified
      ? (isMembership
        ? "Stripe confirmed your test payment. The society committee will confirm your signup, and your membership card will activate once they do."
        : "Stripe confirmed your test payment and your ticket is saved. This is a sandbox transaction, so no real money was charged.")
      : "We couldn't verify a completed payment for this session. If you just paid in test mode, refresh this page or check your Stripe test dashboard."}</p>
    {verified && <div className="success-ticket">{isMembership ? <IdCard size={19}/> : <Ticket size={19}/>}<div><strong>{title}</strong><span>{recorded ? "Saved to your account" : "Payment verified, saving may be delayed"} · Stripe test mode</span></div><CheckCircle2 size={18}/></div>}
    <Link className="success-back" href={verified ? "/my-societies" : "/"}><ArrowLeft size={16}/> {verified ? "Go to My societies" : "Back to SocSync"}</Link>
    <small>Demo prototype · Event and booking data are illustrative.</small>
  </div></main>;
}
