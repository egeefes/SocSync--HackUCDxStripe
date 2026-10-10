// Live check of the AI + Stripe integrations (uses real OpenRouter credits and the Stripe sandbox).
// Run with the dev server running: npm run check:ai
// NOTE: uses up AI imports on the Japanese Society's free plan; run `npm run reset-db` afterwards.
const BASE = process.env.APP_URL || "http://localhost:3000";

// Log in as a seeded demo account and return its session cookie (cached per user).
const sessions = {};
async function demoCookie(userId) {
  if (!sessions[userId]) {
    const res = await fetch(BASE + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    sessions[userId] = (res.headers.getSetCookie().find((c) => c.startsWith("sid=")) || "").split(";")[0];
  }
  return sessions[userId];
}

async function call(path, body, as) {
  const t = Date.now();
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: await demoCookie(as) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - t, json };
}

const show = (title, r) => console.log(`\n=== ${title}  [${r.status}, ${r.ms} ms]\n${JSON.stringify(r.json, null, 2)}`);

// AI 1: caption -> event (relative date, members/non-members price)
show("AI import: Instagram caption", await call("/api/ai/import-event", {
  text: "🎌 CALLIGRAPHY WORKSHOP 🖌️ This Thursday at 6pm in Newman J204! Learn shodō with our committee. Free for members, €2 for non-members. Spaces limited to 30 so come early!! #UCD #japsoc",
}, 5));

// AI 1 failure case: not an event
show("AI import: not an event", await call("/api/ai/import-event", { text: "lol look at this cat 😂😂" }, 5));

// AI 2: harsh but fair review -> should be ALLOWED (Aoife attended event 3)
show("Moderation: harsh but fair (expect 200)", await call("/api/reviews", {
  eventId: 3, stars: 2, comment: "Badly organised: started 30 minutes late and nobody explained the games.",
}, 1));

// AI 2: personal attack -> should be BLOCKED (Tomás attended event 5)
show("Moderation: personal attack (expect 422)", await call("/api/reviews", {
  eventId: 5, stars: 1, comment: "The auditor Mark is a complete idiot and should be kicked out, total loser.",
}, 4));

// AI 3: review summary
show("Review summary: Investment Society", await call("/api/ai/review-summary", { societyId: 5 }, 1));

// Stripe: create a Pro checkout session (as Japanese Society admin)
const pro = await call("/api/stripe/checkout", { kind: "pro" }, 5);
console.log(`\n=== Stripe Pro checkout  [${pro.status}]\n${pro.json.url ? "Checkout URL created ✓ " + pro.json.url.slice(0, 60) + "…" : JSON.stringify(pro.json)}`);
