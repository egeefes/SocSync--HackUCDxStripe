// Banners shown after returning from Stripe Checkout (?checkout=...) or Google sign-in (?google=...).
const MESSAGES = {
  pro: ["success", "🎉 Payment confirmed by Stripe: your society is now on SocSync Pro."],
  ticket: ["success", "🎟️ Payment confirmed by Stripe: your ticket is booked. You're on the attendee list."],
  membership: ["success", "✅ Payment confirmed by Stripe: you're now a member."],
  cancelled: ["info", "Checkout cancelled. You have not been charged."],
  failed: ["error", "Stripe says this payment didn't complete. You have not been charged."],
  error: ["error", "We couldn't confirm the payment with Stripe. Please try again."],
  missing: ["error", "Missing checkout session."],
};

const STYLES = {
  success: "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200",
  info: "bg-accent-soft",
  error: "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200",
};

// After returning from Google's consent screen (?google=...&reason=...).
function googleMessage(google, reason, added) {
  if (google === "connected") {
    return ["success", `📅 Google Calendar connected. ${Number(added) || 0} upcoming events added; new RSVPs and tickets will appear automatically.`];
  }
  if (google === "not-configured") return ["error", "Google Calendar isn't set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local."];
  if (google === "students-only") return ["info", "Google Calendar sync is for student accounts."];
  if (google !== "error") return null;
  if (reason === "access_denied") return ["info", "Google sign-in was cancelled. Nothing was connected."];
  if (reason === "admin_policy_enforced" || reason === "org_internal") {
    return ["error", "Your organisation's Google admin (e.g. UCD IT) doesn't allow this app on your account yet. Try a personal Gmail account, or ask IT to allow it."];
  }
  return ["error", `Couldn't connect Google Calendar (${reason || "unknown error"}). Please try again.`];
}

export default function Flash({ checkout, connect, google, reason, added }) {
  if (connect === "done") return <div className={`mb-4 rounded-lg p-3 text-sm ${STYLES.info}`}>Returned from Stripe payout setup.</div>;
  const msg = MESSAGES[checkout] || googleMessage(google, reason, added);
  if (!msg) return null;
  return <div className={`mb-4 rounded-lg p-3 text-sm ${STYLES[msg[0]]}`}>{msg[1]}</div>;
}
