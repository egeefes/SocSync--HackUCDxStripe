// Stripe Connect: lets a society receive ticket/membership money straight into its own bank account.
// POST -> creates (or reuses) the society's Express account and returns a Stripe onboarding link.
// GET  -> Stripe sends admins here if an onboarding link expires; we make a fresh one.
// Requires Connect to be enabled in the Stripe sandbox dashboard (Connect -> Get started).
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";

async function onboardingUrl(user, origin) {
  const society = db.prepare("SELECT * FROM societies WHERE id = ?").get(user.society_id);
  let accountId = society.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: "IE",
      business_profile: { name: society.name },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    accountId = account.id;
    db.prepare("UPDATE societies SET stripe_account_id = ? WHERE id = ?").run(accountId, society.id);
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/api/stripe/connect`,
    return_url: `${origin}/admin?connect=done`,
  });
  return link.url;
}

export async function POST(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  try {
    return Response.json({ url: await onboardingUrl(user, new URL(request.url).origin) });
  } catch (err) {
    console.error("[stripe connect]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { user, error } = await requireUser({ admin: true });
  if (error) return error;
  return Response.redirect(await onboardingUrl(user, new URL(request.url).origin), 303);
}
