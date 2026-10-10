// API tests: ordinary, boundary and failure inputs (hackathon "Test and learn" criterion).
// Run with the dev server running on a FRESH database:
//   npm run reset-db   (with the server stopped)   then   npm run dev   then   npm run test:api
import { DatabaseSync } from "node:sqlite";
const BASE = process.env.APP_URL || "http://localhost:3000";
const DB_FILE = process.env.SOCSYNC_DB || "data/socsync.db"; // same database the app under test uses

// Seeded demo users: 1-4 students (1 = Aoife), 5 = Japanese Society admin. The SocSync (platform)
// admin's id depends on the database, so look it up.
const PLATFORM = new DatabaseSync(DB_FILE, { readOnly: true }).prepare("SELECT id FROM users WHERE role = 'platform'").get().id;

// `as` = demo user id (logged in via one-click demo login), a cookie string (e.g. from signup), or null (guest).
const cookies = {};
async function cookieFor(as) {
  if (as == null) return "";
  if (typeof as === "string") return as;
  if (!cookies[as]) {
    const res = await fetch(BASE + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: as }) });
    cookies[as] = sessionCookie(res);
  }
  return cookies[as];
}
const sessionCookie = (res) => (res.headers.getSetCookie().find((c) => c.startsWith("sid=")) || "").split(";")[0];

async function call(path, { as = 1, body, method = body ? "POST" : "GET" } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: await cookieFor(as) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, cookie: sessionCookie(res) };
}

function inDays(days, hh = 18) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hh)}:00`;
}

const results = [];
async function test(type, name, fn, expect) {
  try {
    const r = await fn();
    const ok = expect(r);
    results.push({ type, name, ok, got: `${r.status} ${r.json?.error ?? ""}`.trim() });
  } catch (err) {
    results.push({ type, name, ok: false, got: err.message });
  }
}
const is = (code) => (r) => r.status === code;

// ---------- ordinary ----------
await test("ordinary", "Home page loads", () => call("/").then((r) => ({ status: r.status })), is(200));
await test("ordinary", "Follow a society", () => call("/api/follow", { body: { societyId: 2 } }), (r) => r.status === 200 && r.json.following === true);
await test("ordinary", "Unfollow (toggle back)", () => call("/api/follow", { body: { societyId: 2 } }), (r) => r.status === 200 && r.json.following === false);
await test("ordinary", "RSVP to a free upcoming event", () => call("/api/rsvp", { body: { eventId: 9 } }), (r) => r.status === 200 && r.json.going === true);
await test("ordinary", "Review an event I attended", () => call("/api/reviews", { body: { eventId: 3, stars: 4, comment: "Fun night, friendly committee." } }), is(200));
await test("ordinary", "Admin publishes a valid event", () =>
  call("/api/events", { as: 5, body: { title: "Origami Night", start: inDays(5), end: inDays(5, 20), venue: "Global Lounge", price_eur: 0 } }), is(200));

// ---------- boundary ----------
await test("boundary", "0 stars rejected", () => call("/api/reviews", { as: 4, body: { eventId: 5, stars: 0 } }), is(400));
await test("boundary", "6 stars rejected", () => call("/api/reviews", { as: 4, body: { eventId: 5, stars: 6 } }), is(400));
await test("boundary", "2 stars needs an explanation", () => call("/api/reviews", { as: 4, body: { eventId: 5, stars: 2, comment: "meh" } }), is(400));
await test("boundary", "Can't review an event that hasn't happened", () => call("/api/reviews", { body: { eventId: 9, stars: 5 } }), is(400));
await test("boundary", "Can't review the same event twice", () => call("/api/reviews", { body: { eventId: 3, stars: 5 } }), is(400));
await test("boundary", "Event in the past rejected", () => call("/api/events", { as: 5, body: { title: "Old event", start: inDays(-1) } }), is(400));
await test("boundary", "End before start rejected", () => call("/api/events", { as: 5, body: { title: "Backwards", start: inDays(3, 20), end: inDays(3, 18) } }), is(400));
await test("boundary", "Price below Stripe minimum (€0.20) rejected", () => call("/api/events", { as: 5, body: { title: "Cheap", start: inDays(3), price_eur: 0.2 } }), is(400));
await test("boundary", "2-character title rejected", () => call("/api/events", { as: 5, body: { title: "ab", start: inDays(3) } }), is(400));
const small = await call("/api/events", { as: 5, body: { title: "Tiny Tea Ceremony", start: inDays(4), capacity: 1 } });
await test("boundary", "First RSVP takes the last spot", () => call("/api/rsvp", { as: 1, body: { eventId: small.json?.id } }), is(200));
await test("boundary", "Next RSVP gets 'event is full'", () => call("/api/rsvp", { as: 2, body: { eventId: small.json?.id } }), is(409));

// ---------- failure ----------
await test("failure", "Student can't create events", () => call("/api/events", { as: 1, body: { title: "Hack", start: inDays(3) } }), is(403));
await test("failure", "Can't review without attending", () => call("/api/reviews", { as: 2, body: { eventId: 5, stars: 5 } }), is(400));
await test("failure", "Follow a society that doesn't exist", () => call("/api/follow", { body: { societyId: 9999 } }), is(404));
await test("failure", "AI import with nothing to read", () => call("/api/ai/import-event", { as: 5, body: { text: "" } }), is(400));
await test("failure", "AI import with a non-image file", () => call("/api/ai/import-event", { as: 5, body: { imageDataUrl: "data:application/pdf;base64,AAAA" } }), is(400));
await test("failure", "Ticket checkout for a FREE event", () => call("/api/stripe/checkout", { body: { kind: "ticket", eventId: 9 } }), is(400));
await test("failure", "Ticket checkout for a past event", () => call("/api/stripe/checkout", { body: { kind: "ticket", eventId: 1 } }), is(400));
await test("failure", "Student can't buy Pro", () => call("/api/stripe/checkout", { body: { kind: "pro" } }), is(403));
await test("failure", "Unknown purchase type", () => call("/api/stripe/checkout", { body: { kind: "car" } }), is(400));
await test("failure", "Confirm page without a session id", () => call("/api/stripe/confirm"), (r) => r.status === 303);

// ---------- accounts & verification ----------
const num = String(Date.now()).slice(-8); // unique student number, so the tests can be re-run
const newStudent = { name: "Test Student", studentNumber: num, email: `test.${num}@ucdconnect.ie`, password: "correct-horse" };

await test("boundary", "Sign-up: 7-digit student number rejected", () => call("/api/auth/signup", { as: null, body: { ...newStudent, studentNumber: "1234567" } }), is(400));
await test("boundary", "Sign-up: non-UCD email rejected", () => call("/api/auth/signup", { as: null, body: { ...newStudent, email: "someone@gmail.com" } }), is(400));
await test("boundary", "Sign-up: 7-character password rejected", () => call("/api/auth/signup", { as: null, body: { ...newStudent, password: "short12" } }), is(400));
const signup = await call("/api/auth/signup", { as: null, body: newStudent });
await test("ordinary", "Sign-up: new student account is created as pending", async () => signup, (r) => r.status === 200 && r.json.status === "pending");
await test("boundary", "Sign-up: same student number twice rejected", () => call("/api/auth/signup", { as: null, body: { ...newStudent, email: `other.${num}@ucdconnect.ie` } }), is(409));
await test("failure", "Log in with the wrong password", () => call("/api/auth/login", { as: null, body: { email: newStudent.email, password: "wrong-password" } }), is(401));
const login = await call("/api/auth/login", { as: null, body: { email: newStudent.email, password: newStudent.password } });
await test("ordinary", "Log in with email + password", async () => login, is(200));
const me = login.cookie;
await test("ordinary", "Pending student can still follow societies", () => call("/api/follow", { as: me, body: { societyId: 3 } }), is(200));
await test("failure", "Pending student can't RSVP yet", () => call("/api/rsvp", { as: me, body: { eventId: 9 } }), is(403));
await test("failure", "Guest can't follow (must log in)", () => call("/api/follow", { as: null, body: { societyId: 3 } }), is(401));
await test("failure", "A student can't approve accounts", () => call("/api/platform/review", { as: 2, body: { type: "student", id: 1, decision: "approve" } }), is(403));
await test("failure", "Demo one-click login refused for a real account", async () => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const id = db.prepare("SELECT id FROM users WHERE email = ?").get(newStudent.email).id;
  return call("/api/login", { as: null, body: { userId: id } });
}, is(403));

// Student verification: pending -> SocSync admin approves -> RSVP works.
const num2 = String(Number(num) + 1).padStart(8, "0").slice(-8);
const second = await call("/api/auth/signup", { as: null, body: { ...newStudent, studentNumber: num2, email: `second.${num2}@ucdconnect.ie` } });
const secondId = new DatabaseSync(DB_FILE, { readOnly: true }).prepare("SELECT id FROM users WHERE student_number = ?").get(num2)?.id;
await test("ordinary", "SocSync admin verifies a new student", () => call("/api/platform/review", { as: PLATFORM, body: { type: "student", id: secondId, decision: "approve" } }), is(200));
await test("ordinary", "Verified student can now RSVP", () => call("/api/rsvp", { as: second.cookie, body: { eventId: 9 } }), is(200));

// Society application -> hidden until the platform admin approves -> applicant becomes its admin.
const socName = `Test Society ${num}`;
const apply = await call("/api/societies/register", {
  as: me,
  body: { name: socName, category: "Social & Hobbies", role: "Auditor", description: "A society created by the automated tests.", evidence: "Listed on the SU page; elected auditor at our AGM." },
});
await test("ordinary", "Student applies to register a society (pending)", async () => apply, (r) => r.status === 200 && r.json.status === "pending");
await test("boundary", "Second application while one is pending is refused", () => call("/api/societies/register", { as: me, body: { name: "Another One", category: "Business", role: "Auditor", description: "Another description that is long enough.", evidence: "Evidence that is long enough to pass." } }), is(409));
await test("ordinary", "Pending society is hidden from students", () => call("/api/follow", { as: 1, body: { societyId: apply.json?.id } }), is(404));
await test("boundary", "Rejecting without a reason is refused", () => call("/api/platform/review", { as: PLATFORM, body: { type: "society", id: apply.json?.id, decision: "reject" } }), is(400));
await test("ordinary", "SocSync admin approves the society", () => call("/api/platform/review", { as: PLATFORM, body: { type: "society", id: apply.json?.id, decision: "approve" } }), is(200));
await test("ordinary", "Approved society is visible (students can follow)", () => call("/api/follow", { as: 1, body: { societyId: apply.json?.id } }), is(200));
await test("ordinary", "Applicant is now its admin and can publish events", () => call("/api/events", { as: me, body: { title: "First Meetup", start: inDays(6) } }), is(200));

// ---------- login page is the front door ----------
await test("ordinary", "Logged-out visitor is sent to the login page", async () => {
  const res = await fetch(BASE + "/", { redirect: "manual" });
  return { status: res.status, json: { error: res.headers.get("location") } };
}, (r) => r.status === 307 && /\/login$/.test(r.json.error));
await test("failure", "Society tab refuses a plain student account", () => call("/api/auth/login", { as: null, body: { email: `second.${num2}@ucdconnect.ie`, password: newStudent.password, as: "society" } }), is(403));
await test("failure", "Student tab refuses a society account", () => call("/api/auth/login", { as: null, body: { email: newStudent.email, password: newStudent.password, as: "student" } }), is(403));
await test("ordinary", "Society tab logs a society admin into the dashboard", () => call("/api/auth/login", { as: null, body: { email: newStudent.email, password: newStudent.password, as: "society" } }), (r) => r.status === 200 && r.json.redirect === "/admin");

// New person registers a society in ONE step (account + society together).
const num3 = String(Number(num) + 2).padStart(8, "0").slice(-8);
const oneStep = { applicantName: "New Auditor", studentNumber: num3, email: `auditor.${num3}@ucdconnect.ie`, password: "society-pass",
  name: `One Step Society ${num}`, category: "Business", role: "Auditor", description: "Registered in one step by the tests.", evidence: "Listed on the SU page; elected at the AGM." };
await test("boundary", "One-step register: bad account details create nothing", () => call("/api/societies/register", { as: null, body: { ...oneStep, email: "x@gmail.com" } }), is(400));
await test("ordinary", "One-step register: account + pending society created", () => call("/api/societies/register", { as: null, body: oneStep }), (r) => r.status === 200 && r.json.status === "pending");
await test("ordinary", "Applicant can log in (Society tab) to see their application", () => call("/api/auth/login", { as: null, body: { email: oneStep.email, password: oneStep.password, as: "society" } }), (r) => r.status === 200 && r.json.redirect === "/register-society");

// ---------- AI event finder (input checks only; no AI credits used) ----------
await test("boundary", "AI finder: 2-character request rejected", () => call("/api/ai/find-events", { body: { prompt: "hi" } }), is(400));
await test("boundary", "AI finder: 301-character request rejected", () => call("/api/ai/find-events", { body: { prompt: "x".repeat(301) } }), is(400));
await test("failure", "AI finder: guest must log in", () => call("/api/ai/find-events", { as: null, body: { prompt: "free events" } }), is(401));

// ---------- AI poster designer (input checks only; no AI credits used) ----------
await test("failure", "AI poster: students can't design posters", () => call("/api/ai/design-poster", { as: 1, body: { title: "Games Night", start: inDays(3) } }), is(403));
await test("boundary", "AI poster: needs a title first", () => call("/api/ai/design-poster", { as: 5, body: { title: "", start: inDays(3) } }), is(400));
await test("boundary", "AI poster: needs a start time first", () => call("/api/ai/design-poster", { as: 5, body: { title: "Games Night" } }), is(400));
await test("failure", "Publishing with a non-image 'poster' is rejected", () => call("/api/events", { as: 5, body: { title: "Bad Poster Night", start: inDays(4), poster: "data:text/html;base64,PGgxPg==" } }), is(400));
const tinyJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const withPoster = await call("/api/events", { as: 5, body: { title: "Poster Night", start: inDays(4), poster: tinyJpeg } });
await test("ordinary", "Publishing with an AI poster saves it", async () => withPoster, is(200));
await test("ordinary", "The saved poster is served as an image", async () => {
  const res = await fetch(`${BASE}/api/events/${withPoster.json?.id}/poster`);
  return { status: res.status, json: { error: res.headers.get("content-type") } };
}, (r) => r.status === 200 && r.json.error === "image/jpeg");

// ---------- society Instagram handle ----------
await test("failure", "Instagram: students can't edit a society profile", () => call("/api/societies/profile", { as: 1, body: { instagram: "@x" } }), is(403));
await test("boundary", "Instagram: invalid handle rejected", () => call("/api/societies/profile", { as: 5, body: { instagram: "bad handle!" } }), is(400));
await test("ordinary", "Instagram: full link is cleaned to @handle", () => call("/api/societies/profile", { as: 5, body: { instagram: "https://www.instagram.com/ucd.japsoc/?hl=en" } }), (r) => r.status === 200 && r.json.instagram === "@ucd.japsoc");
await test("ordinary", "Instagram: empty clears it", () => call("/api/societies/profile", { as: 5, body: { instagram: "" } }), (r) => r.status === 200 && r.json.instagram === null);

// ---------- society profile: pictures, about us, committee ----------
const imageType = async (path) => { const res = await fetch(BASE + path); return { status: res.status, json: { error: res.headers.get("content-type") } }; };
await test("failure", "Profile: a non-image 'profile picture' is rejected", () => call("/api/societies/profile", { as: 5, body: { avatar: "data:text/html;base64,PGgxPg==" } }), is(400));
await test("boundary", "Profile: committee member without a role is rejected", () => call("/api/societies/profile", { as: 5, body: { committee: [{ name: "Hana", role: "" }] } }), is(400));
await test("ordinary", "Profile: about us + committee saved", () => call("/api/societies/profile", { as: 5, body: { bio: "We love Japan.", committee: [{ name: "Hana S.", role: "Auditor", bio: "" }] } }), is(200));
await test("ordinary", "Profile: profile picture uploaded", () => call("/api/societies/profile", { as: 5, body: { avatar: tinyJpeg } }), is(200));
await test("ordinary", "Profile: picture is served as an image", () => imageType("/api/societies/1/image/avatar"), (r) => r.status === 200 && r.json.error === "image/jpeg");
await test("ordinary", "Profile: saving only Instagram keeps the picture", async () => {
  await call("/api/societies/profile", { as: 5, body: { instagram: "@ucdjapsoc" } });
  return imageType("/api/societies/1/image/avatar");
}, is(200));
await test("ordinary", "Profile: picture removed with empty value", async () => {
  await call("/api/societies/profile", { as: 5, body: { avatar: "" } });
  return imageType("/api/societies/1/image/avatar");
}, is(404));

// ---------- reviews of a society as a whole ----------
await test("ordinary", "Society review: attendee posts a review", () => call("/api/societies/1/reviews", { as: 2, body: { stars: 4, comment: "Friendly people, great exchange." } }), (r) => r.status === 200 && r.json.updated === false);
await test("ordinary", "Society review: posting again edits it", () => call("/api/societies/1/reviews", { as: 2, body: { stars: 5, comment: "Even better the second time." } }), (r) => r.status === 200 && r.json.updated === true);
await test("failure", "Society review: never a member or attendee", () => call("/api/societies/9/reviews", { as: 3, body: { stars: 5 } }), is(403));
await test("failure", "Society review: society admins can't review", () => call("/api/societies/1/reviews", { as: 5, body: { stars: 5 } }), is(403));
await test("boundary", "Society review: 6 stars rejected", () => call("/api/societies/1/reviews", { as: 2, body: { stars: 6 } }), is(400));
await test("ordinary", "Society review: delete my review", () => call("/api/societies/1/reviews", { as: 2, method: "DELETE" }), is(200));
await test("boundary", "Society review: deleting twice", () => call("/api/societies/1/reviews", { as: 2, method: "DELETE" }), is(404));

// ---------- edit / delete / repeat events ----------
await test("ordinary", "Edit event: admin renames own upcoming event", () => call("/api/events/7", { as: 5, method: "PATCH", body: { title: "Calligraphy Workshop (new room)", start: inDays(1, 17), venue: "Newman J210" } }), is(200));
await test("boundary", "Edit event: capacity below people going", () => call("/api/events/7", { as: 5, method: "PATCH", body: { title: "Calligraphy Workshop", start: inDays(1, 17), capacity: 1 } }), is(400));
await test("failure", "Edit event: another society's event", () => call("/api/events/9", { as: 5, method: "PATCH", body: { title: "Hijacked", start: inDays(2, 13) } }), is(404));
await test("failure", "Edit event: past events can't change", () => call("/api/events/1", { as: 5, method: "PATCH", body: { title: "Old", start: inDays(3) } }), is(400));
await test("failure", "Edit event: students can't edit", () => call("/api/events/7", { as: 1, method: "PATCH", body: { title: "x", start: inDays(3) } }), is(403));
const repeated = await call("/api/events", { as: 5, body: { title: "Weekly Tea Club", start: inDays(2, 16), repeat: "weekly", repeat_count: 3 } });
await test("ordinary", "Repeat: weekly x3 creates 3 events", async () => repeated, (r) => r.status === 200 && r.json.ids?.length === 3);
await test("boundary", "Repeat: 13 times rejected", () => call("/api/events", { as: 5, body: { title: "Too Many", start: inDays(2), repeat: "weekly", repeat_count: 13 } }), is(400));
await test("ordinary", "Delete event: admin deletes own event", () => call(`/api/events/${repeated.json?.ids?.[2]}`, { as: 5, method: "DELETE" }), is(200));
await test("failure", "Delete event: another society's event", () => call("/api/events/9", { as: 5, method: "DELETE" }), is(404));

// ---------- free RSVP = reserved ticket with QR code ----------
await test("ordinary", "Free RSVP shows a reserved ticket with QR on the event page", async () => {
  const res = await fetch(`${BASE}/events/9`, { headers: { Cookie: await cookieFor(1) } });
  const html = await res.text();
  return { status: res.status, json: { error: html.includes("FREE · RESERVED") && html.includes("QR code for ticket SS-R") ? "ticket shown" : "no ticket" } };
}, (r) => r.status === 200 && r.json.error === "ticket shown");

// ---------- report ----------
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${pad(r.type, 9)} ${pad(r.name, 48)} ${r.got}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
