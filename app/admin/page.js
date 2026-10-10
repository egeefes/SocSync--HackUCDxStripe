// Society admin dashboard: create events (with AI import), plan & billing, payouts, sales, feedback.
import Link from "next/link";
import EventForm from "@/components/EventForm";
import SocietyProfileEditor from "@/components/SocietyProfileEditor";
import EventsManager from "@/components/EventsManager";
import ActionButton from "@/components/ActionButton";
import ReviewSummary from "@/components/ReviewSummary";
import Flash from "@/components/Flash";
import { pageUser } from "@/lib/session";
import { societyDashboard, societyReviews, societyMembers, getSocietyWithMedia } from "@/lib/queries";
import { FREE_AI_IMPORTS } from "@/lib/ai-features";
import { PRO_PRICE_CENTS, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { euro, stars, nowLocal } from "@/lib/format";

export default async function AdminPage({ searchParams }) {
  const { checkout, connect } = await searchParams;
  const user = await pageUser({ role: "admin" }); // students / SocSync admin are sent to their own home
  const society = await getSocietyWithMedia(user.society_id);
  const [{ events, payments }, members, reviews] = await Promise.all([
    societyDashboard(society.id),
    societyMembers(society.id),
    societyReviews(society.id),
  ]);
  const isPro = society.plan === "pro";
  const revenue = payments.filter((p) => p.kind !== "pro").reduce((sum, p) => sum + p.amount_cents - p.platform_fee_cents, 0);

  return (
    <div className="space-y-6">
      <Flash checkout={checkout} connect={connect} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{society.name} · dashboard</h1>
          <Link href={`/societies/${society.id}`} className="text-sm text-accent hover:underline">View public page</Link>
        </div>
        <span className={`chip ${isPro ? "!bg-green-100 !text-green-800" : ""}`}>{isPro ? "Pro plan ✓" : "Free plan"}</span>
      </div>

      <SocietyProfileEditor society={{ id: society.id, instagram: society.instagram, bio: society.bio, committee: society.committee_json ? JSON.parse(society.committee_json) : [], has_avatar: society.has_avatar, has_cover: society.has_cover, has_card_bg: society.has_card_bg, media_version: society.media_version }} />

      <EventForm aiImportsLeft={isPro ? null : Math.max(FREE_AI_IMPORTS - society.ai_imports_used, 0)} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-2">
          <h3 className="font-semibold">Plan</h3>
          {isPro ? (
            <p className="text-sm">SocSync Pro is active: unlimited AI poster imports.</p>
          ) : (
            <>
              <p className="text-sm">
                <b>SocSync Pro, {euro(PRO_PRICE_CENTS)}/month:</b> unlimited AI poster imports (free plan: 3). Cancel anytime.
              </p>
              <ActionButton endpoint="/api/stripe/checkout" body={{ kind: "pro" }}>Upgrade to Pro</ActionButton>
            </>
          )}
        </div>
        <div className="card space-y-2">
          <h3 className="font-semibold">Payouts</h3>
          <p className="text-sm">
            Ticket and membership money goes straight to your society&apos;s bank account via Stripe. SocSync keeps {PLATFORM_FEE_PERCENT}%.
          </p>
          <p className="text-xs text-muted">{society.stripe_account_id ? `Stripe account: ${society.stripe_account_id}` : "Not set up yet."}</p>
          <ActionButton endpoint="/api/stripe/connect" variant="secondary">
            {society.stripe_account_id ? "Continue payout setup" : "Set up payouts"}
          </ActionButton>
        </div>
        <div className="card space-y-1">
          <h3 className="font-semibold">Sales</h3>
          <p className="text-2xl font-bold">{euro(revenue)}</p>
          <p className="text-xs text-muted">to the society, after fees · {payments.filter((p) => p.kind !== "pro").length} payments</p>
          <p className="text-sm text-amber-600">{stars(reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : null)} from {reviews.length} reviews</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EventsManager events={events} now={nowLocal()} />
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            <h3 className="mb-2 font-semibold">
              Members ({members.length}) <span className="text-sm font-normal text-muted">· {euro(society.membership_fee_cents)}/year</span>
            </h3>
            {members.length === 0 && <p className="text-sm text-muted">No paid members yet. Students join from your public page.</p>}
            {members.map((m) => (
              <div key={m.student_number} className="flex justify-between border-t border-border py-1.5 text-sm first:border-0">
                <span>{m.name} <span className="text-xs text-muted">({m.student_number})</span></span>
                <span className="text-xs text-muted">joined {m.created_at.slice(0, 10)}</span>
              </div>
            ))}
          </div>
          <ReviewSummary societyId={society.id} reviewCount={reviews.length} />
          <div className="card overflow-x-auto">
            <h3 className="mb-2 font-semibold">Recent payments (Stripe sandbox)</h3>
            {payments.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between border-t border-border py-1.5 text-sm first:border-0">
                <span>{p.kind === "pro" ? "SocSync Pro subscription" : `${p.kind === "ticket" ? `🎟️ ${p.event_title}` : "Membership"} · ${p.user_name}`}</span>
                <span>{euro(p.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
