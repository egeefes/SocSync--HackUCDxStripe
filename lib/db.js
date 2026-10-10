// Database: a single SQLite file (data/socsync.db) using Node's built-in sqlite module.
// The first time the app runs it creates the tables and fills them with SYNTHETIC demo data.
// To start fresh: `npm run reset-db` (deletes the file; it is recreated on next request).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// SOCSYNC_DB lets tests run against a throwaway database without touching the real one.
// Vercel's deployed function bundle (/var/task) is read-only. SQLite can only be
// used there as an ephemeral emergency fallback under /tmp; it is NOT durable
// or shared across serverless instances. Use PostgreSQL for production persistence.
const DB_PATH =
  process.env.SOCSYNC_DB ||
  (process.env.VERCEL
    ? path.join("/tmp", "socsync.db")
    : path.join(process.cwd(), "data", "socsync.db"));
const DB_DIR = path.dirname(DB_PATH);

export const CATEGORIES = [
  "Languages & Culture",
  "Business",
  "Sport & Outdoors",
  "Arts & Performance",
  "Academic & Tech",
  "Social & Hobbies",
];

export const COMMITTEE_ROLES = ["Auditor", "Chairperson", "Secretary", "Treasurer", "PRO", "Other committee member"];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS societies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  instagram TEXT,
  membership_fee_cents INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',          -- 'free' | 'pro'
  ai_imports_used INTEGER NOT NULL DEFAULT 0,  -- free plan gets a few AI imports
  stripe_subscription_id TEXT,
  stripe_account_id TEXT                       -- Stripe Connect account (payouts to the society)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  student_number TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student',        -- 'student' | 'admin' (society) | 'platform' (SocSync admin)
  society_id INTEGER REFERENCES societies(id)  -- set for society admins
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  society_id INTEGER NOT NULL REFERENCES societies(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT 'TBC',
  start TEXT NOT NULL,                         -- local time, 'YYYY-MM-DDTHH:mm' (Europe/Dublin)
  end TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,      -- 0 = free event
  capacity INTEGER,                            -- NULL = unlimited
  created_via TEXT NOT NULL DEFAULT 'manual'   -- 'manual' | 'ai'
);

CREATE TABLE IF NOT EXISTS follows (
  user_id INTEGER NOT NULL REFERENCES users(id),
  society_id INTEGER NOT NULL REFERENCES societies(id),
  PRIMARY KEY (user_id, society_id)
);

CREATE TABLE IF NOT EXISTS rsvps (
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  moderation TEXT NOT NULL DEFAULT 'ok',       -- 'ok' | 'unchecked' (AI was unavailable)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, event_id)                   -- one review per student per event
);

-- Every successful Stripe checkout: event tickets, society memberships, Pro subscriptions.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,                          -- 'ticket' | 'membership' | 'pro'
  user_id INTEGER REFERENCES users(id),
  society_id INTEGER NOT NULL REFERENCES societies(id),
  event_id INTEGER REFERENCES events(id),
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  stripe_session_id TEXT NOT NULL UNIQUE,      -- makes fulfilment idempotent
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Logged-in sessions: a random token in an httpOnly cookie points to a user.
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached AI review summaries, regenerated when the number of reviews changes.
CREATE TABLE IF NOT EXISTS ai_summaries (
  society_id INTEGER PRIMARY KEY REFERENCES societies(id),
  review_count INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Columns added after the first version. Added to existing databases too, so nobody has to reset.
const MIGRATIONS = [
  // accounts & verification
  ["users", "email", "TEXT"],
  ["users", "password_hash", "TEXT"],                         // scrypt 'salt:hash'; NULL for demo accounts
  ["users", "status", "TEXT NOT NULL DEFAULT 'verified'"],     // 'pending' | 'verified' | 'rejected'
  ["users", "review_note", "TEXT"],                           // reason shown if rejected
  ["users", "is_demo", "INTEGER NOT NULL DEFAULT 0"],         // demo accounts: one-click login, no password
  ["users", "created_at", "TEXT"],
  // society applications
  ["societies", "status", "TEXT NOT NULL DEFAULT 'approved'"], // 'pending' | 'approved' | 'rejected'
  ["societies", "applicant_user_id", "INTEGER REFERENCES users(id)"],
  ["societies", "applicant_role", "TEXT"],                     // e.g. 'Auditor'
  ["societies", "evidence", "TEXT"],                           // why we should believe them
  ["societies", "review_note", "TEXT"],
  ["societies", "applied_at", "TEXT"],
  // Google Calendar sync
  ["users", "google_refresh_token", "TEXT"],                  // lets us add events to their calendar later
  ["users", "google_email", "TEXT"],                          // which Google account is connected
  // Society profile (pictures live in society_media)
  ["societies", "bio", "TEXT"],                               // longer "About us" text
  ["societies", "committee_json", "TEXT"],                    // [{ name, role, bio }]
];

function migrate(db) {
  for (const [table, column, type] of MIGRATIONS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)");
  // AI-designed posters (kept out of the events table so event lists stay small).
  db.exec(`CREATE TABLE IF NOT EXISTS event_posters (
    event_id INTEGER PRIMARY KEY REFERENCES events(id),
    image_data TEXT NOT NULL,          -- data:image/jpeg;base64,...
    design_json TEXT,                  -- what the AI chose (headline, palette, ...)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  // Society pictures: profile picture (avatar), cover banner, membership-card background.
  db.exec(`CREATE TABLE IF NOT EXISTS society_media (
    society_id INTEGER NOT NULL REFERENCES societies(id),
    kind TEXT NOT NULL CHECK (kind IN ('avatar', 'cover', 'card')),
    image_data TEXT NOT NULL,          -- data:image/jpeg;base64,...
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (society_id, kind)
  )`);
  // Reviews of a society as a whole (event reviews live in "reviews").
  db.exec(`CREATE TABLE IF NOT EXISTS society_reviews (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    society_id INTEGER NOT NULL REFERENCES societies(id),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    moderation TEXT NOT NULL DEFAULT 'ok',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, society_id)       -- one per student per society; posting again edits it
  )`);
  // Which SocSync event became which Google Calendar event (so we can update / delete it later).
  db.exec(`CREATE TABLE IF NOT EXISTS google_events (
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    google_event_id TEXT NOT NULL,
    PRIMARY KEY (user_id, event_id)
  )`);
}

// Runs every start-up: mark seeded accounts as demo accounts and make sure the platform admin exists.
function ensureDemoAccounts(db) {
  db.exec("UPDATE users SET is_demo = 1 WHERE password_hash IS NULL AND is_demo = 0");
  // Early demo data had made-up Instagram handles that could belong to real strangers: clear them.
  db.exec("UPDATE societies SET instagram = NULL WHERE instagram LIKE '@demo\\_%' ESCAPE '\\'");
  const platform = db.prepare("SELECT 1 FROM users WHERE role = 'platform'").get();
  if (!platform) {
    db.prepare(
      "INSERT INTO users (name, student_number, role, status, is_demo, created_at) VALUES (?, ?, 'platform', 'verified', 1, datetime('now'))"
    ).run("SocSync Admin (you)", "00000000");
  }
}

// ---------- synthetic seed data ----------

// Local 'YYYY-MM-DDTHH:mm' string, `days` from today at hh:mm.
function at(days, hh, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
}

function seed(db) {
  const societies = [
    // [name, category, description, instagram, membership fee cents]
    ["Japanese Society", "Languages & Culture", "Language exchange, anime nights, calligraphy and the yearly cultural festival.", null, 200],
    ["French Society", "Languages & Culture", "Conversation tables for all levels, film nights and crêpe days.", null, 200],
    ["German Society", "Languages & Culture", "Stammtisch every week, Oktoberfest social and exam-prep sessions.", null, 200],
    ["Entrepreneurs Society", "Business", "Founder talks, pitch nights and a startup weekend every spring.", null, 200],
    ["Investment Society", "Business", "Markets workshops, stock-pitch competition and industry panels.", null, 200],
    ["Mountaineering Club", "Sport & Outdoors", "Weekly climbing walls and weekend hiking trips around Wicklow and the West.", null, 500],
    ["Engineering Society", "Academic & Tech", "Industry nights, study sessions and the Engineering Ball.", null, 200],
    ["Computer Science Society", "Academic & Tech", "Hack nights, coding interview prep and tech talks.", null, 200],
    ["Drama Society", "Arts & Performance", "Two big productions a year plus improv workshops open to everyone.", null, 200],
    ["Board Games Society", "Social & Hobbies", "Relaxed games nights with a 300+ game library. Newcomers welcome.", null, 200],
  ];
  const insSoc = db.prepare(
    "INSERT INTO societies (name, category, description, instagram, membership_fee_cents) VALUES (?, ?, ?, ?, ?)"
  );
  for (const s of societies) insSoc.run(...s);

  const users = [
    // [name, student number, role, society_id]
    ["Aoife Murphy", "21345678", "student", null],
    ["Cian O'Brien", "22456789", "student", null],
    ["Priya Sharma", "23567890", "student", null],
    ["Tomás Byrne", "21987654", "student", null],
    ["Japanese Society (admin)", "20111111", "admin", 1],
    ["Mountaineering Club (admin)", "20222222", "admin", 6],
    ["Engineering Society (admin)", "20333333", "admin", 7],
  ];
  const insUser = db.prepare("INSERT INTO users (name, student_number, role, society_id) VALUES (?, ?, ?, ?)");
  for (const u of users) insUser.run(...u);

  const events = [
    // [society, title, description, venue, start, end, price cents, capacity]
    // --- past events (can be reviewed) ---
    [1, "Japanese Language Exchange", "Practise Japanese and English with native speakers. All levels.", "Global Lounge", at(-8, 18), at(-8, 20), 0, null],
    [1, "Anime Night: Spirited Away", "Screening with snacks and a short discussion after.", "Newman Building G20", at(-5, 19), at(-5, 22), 0, 80],
    [10, "Games Night", "Bring friends or come alone, we'll find you a table.", "Student Centre, Room 2", at(-6, 18), at(-6, 22), 0, null],
    [5, "Intro to Investing Workshop", "How the stock market works, ETFs, and how to start small.", "Quinn School Q0.12", at(-7, 17), at(-7, 18, 30), 0, 60],
    [8, "Hack Night", "Bring a project or join one. Pizza at 8pm.", "Computer Science Building, Lab 1", at(-4, 18), at(-4, 23), 0, 50],
    [6, "Climbing Wall Session", "Indoor bouldering, gear provided. Beginners very welcome.", "UCD Sport Centre", at(-3, 19), at(-3, 21), 0, 25],
    // --- upcoming events ---
    [1, "Calligraphy Workshop", "Learn the basics of shodō. Materials provided.", "Newman Building J204", at(1, 17), at(1, 19), 0, 30],
    [1, "Japanese Language Exchange", "Weekly exchange, all levels welcome.", "Global Lounge", at(3, 18), at(3, 20), 0, null],
    [2, "Table de Conversation", "French conversation, beginner and intermediate tables.", "Newman Building G15", at(2, 13), at(2, 14), 0, null],
    [2, "Crêpe Day", "Free crêpes for members, €1 for everyone else.", "Student Centre Foyer", at(4, 12), at(4, 14), 0, null],
    [3, "Stammtisch", "Relaxed German conversation over drinks.", "Student Bar", at(2, 19), at(2, 21), 0, null],
    [4, "Founder Fireside Chat", "A UCD alumnus on building their first startup.", "O'Reilly Hall", at(3, 18, 30), at(3, 20), 0, 200],
    [4, "Pitch Night", "Pitch your idea in 3 minutes, get feedback from founders.", "Quinn School Q0.18", at(9, 18), at(9, 20), 0, 40],
    [5, "Stock Pitch Competition Info Session", "Teams, rules and prizes for this year's competition.", "Quinn School Q0.12", at(5, 17), at(5, 18), 0, null],
    [6, "Wicklow Way Weekend Trip", "Two days hiking the Wicklow Way. Price includes bus, hostel and dinner.", "Departs from UCD main entrance", at(7, 8), at(8, 18), 2000, 30],
    [6, "Climbing Wall Session", "Indoor bouldering, gear provided.", "UCD Sport Centre", at(4, 19), at(4, 21), 0, 25],
    [7, "Engineering Ball", "Black-tie ball with dinner, band and DJ. Ticket includes a three-course meal.", "Clayton Hotel Burlington Road", at(12, 19), at(13, 1), 3000, 250],
    [7, "Industry Night", "Meet engineering employers hiring interns and graduates.", "Engineering Building Atrium", at(6, 18), at(6, 21), 0, null],
    [8, "Coding Interview Prep", "Mock interviews and LeetCode practice in pairs.", "Computer Science Building, Lab 2", at(2, 18), at(2, 20), 0, 40],
    [9, "Improv Workshop", "No experience needed. Wear comfy clothes.", "Dramsoc Theatre", at(1, 18), at(1, 20), 0, 25],
    [9, "Autumn Production: Twelfth Night", "Our first production of the year.", "Astra Hall", at(10, 19, 30), at(10, 22), 800, 150],
    [10, "Games Night", "Weekly games night. New games just arrived!", "Student Centre, Room 2", at(1, 18), at(1, 22), 0, null],
  ];
  const insEvent = db.prepare(
    "INSERT INTO events (society_id, title, description, venue, start, end, price_cents, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const e of events) insEvent.run(...e);

  // Aoife follows a few societies so her calendar isn't empty.
  const insFollow = db.prepare("INSERT INTO follows (user_id, society_id) VALUES (?, ?)");
  for (const [u, s] of [[1, 1], [1, 6], [1, 8], [2, 4], [2, 5], [3, 2], [3, 10], [4, 7]]) insFollow.run(u, s);

  // Past-event RSVPs + reviews (only RSVP'd students can review).
  const reviews = [
    // [user, event, stars, comment]
    [1, 1, 5, "Really welcoming, paired me with a native speaker straight away."],
    [2, 1, 4, "Good event, a bit crowded towards the end."],
    [3, 1, 5, "Best language exchange on campus."],
    [1, 2, 5, "Great film choice and the discussion after was fun."],
    [4, 2, 4, "Nice night, projector was a bit dim."],
    [2, 3, 4, "Loads of games and the committee explained the rules well."],
    [3, 3, 3, "Fun but hard to find a table, it was packed."],
    [1, 4, 2, "Started 25 minutes late and the slides were hard to follow."],
    [2, 4, 2, "Felt like a sales pitch for a bank, not a workshop."],
    [4, 4, 3, "Some useful bits on ETFs but too rushed."],
    [1, 5, 5, "Super chill, got help with my project from a final-year."],
    [3, 5, 4, "Good vibes, pizza ran out quickly though."],
    [1, 6, 5, "Instructors were great with beginners."],
    [4, 6, 4, "Good session, would like longer slots."],
  ];
  const insRsvp = db.prepare("INSERT OR IGNORE INTO rsvps (user_id, event_id) VALUES (?, ?)");
  const insReview = db.prepare("INSERT INTO reviews (user_id, event_id, stars, comment) VALUES (?, ?, ?, ?)");
  for (const [u, e, stars, comment] of reviews) {
    insRsvp.run(u, e);
    insReview.run(u, e, stars, comment);
  }
  // Attended but not reviewed yet, so the demo can show leaving a review live
  // (e.g. Aoife -> Games Night, Tomás -> Hack Night).
  for (const [u, e] of [[1, 3], [4, 5], [2, 6], [3, 2]]) insRsvp.run(u, e);
  // Upcoming RSVPs so attendance numbers aren't all zero.
  for (const [u, e] of [[1, 7], [2, 7], [3, 9], [1, 19], [4, 18]]) insRsvp.run(u, e);

  // Society profiles (fictional committee names) + a few reviews of societies as a whole.
  const profile = db.prepare("UPDATE societies SET bio = ?, committee_json = ? WHERE id = ?");
  profile.run(
    "We're a friendly mix of Japanese and Irish students. Every week we run a language exchange, and every month something bigger: anime screenings, calligraphy, a sushi night or the cultural festival in spring. No Japanese needed to join!",
    JSON.stringify([
      { name: "Hana S.", role: "Auditor", bio: "Final-year Commerce, runs the language exchange." },
      { name: "Conor D.", role: "Treasurer", bio: "Learning Japanese for three years and counting." },
      { name: "Yuki T.", role: "Events Officer", bio: "Organises the anime nights and the festival." },
    ]),
    1
  );
  profile.run(
    "From Tuesday climbing-wall sessions to weekend trips in Wicklow, Connemara and the Mournes. Gear is provided for beginners and every trip has a qualified leader.",
    JSON.stringify([
      { name: "Aisling R.", role: "Captain", bio: "Mountain leader, loves a wet day in Glendalough." },
      { name: "Tom B.", role: "Safety Officer", bio: "First-aid trained, checks every route twice." },
    ]),
    6
  );
  const insSocReview = db.prepare("INSERT INTO society_reviews (user_id, society_id, stars, comment) VALUES (?, ?, ?, ?)");
  insSocReview.run(1, 1, 5, "The most welcoming society I've joined. The committee remembers your name after one event.");
  insSocReview.run(3, 1, 4, "Great mix of events every week. The festival is the highlight.");
  insSocReview.run(4, 6, 5, "Really well organised trips, and they look after beginners properly.");

  // Something waiting in the platform admin's review queue, to demo verification live.
  const pending = db
    .prepare(
      "INSERT INTO users (name, student_number, email, role, status, is_demo, created_at) VALUES (?, ?, ?, 'student', 'pending', 1, datetime('now'))"
    )
    .run("Liam Kelly (new signup)", "24112233", "liam.kelly@ucdconnect.ie");
  db.prepare(
    `INSERT INTO societies (name, category, description, instagram, membership_fee_cents, status, applicant_user_id, applicant_role, evidence, applied_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, datetime('now'))`
  ).run(
    "Anime & Manga Society",
    "Arts & Performance",
    "Weekly screenings, manga library and a yearly convention trip.",
    null,
    300,
    Number(pending.lastInsertRowid),
    "Auditor",
    "Listed on the Students' Union societies page. I was elected auditor at our AGM on 2 October."
  );
}

function open() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const isNew = !fs.existsSync(DB_PATH);
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  if (isNew) {
    db.exec("BEGIN");
    try {
      seed(db);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  ensureDemoAccounts(db);
  return db;
}

// Reuse one connection across hot reloads in development.
const conn = globalThis.__socsyncDb ?? (globalThis.__socsyncDb = open());
migrate(conn); // cheap and idempotent: new columns also arrive while `npm run dev` keeps running
ensureDemoAccounts(conn); // idempotent too

// node:sqlite returns rows as null-prototype objects, which React refuses to pass to client
// components. This tiny wrapper turns every row into a plain object; usage is unchanged:
//   db.prepare(sql).all(...params) / .get(...params) / .run(...params)
const plain = (row) => (row ? { ...row } : row);
const db = {
  exec: (sql) => conn.exec(sql),
  prepare(sql) {
    const stmt = conn.prepare(sql);
    return {
      all: (...params) => stmt.all(...params).map(plain),
      get: (...params) => plain(stmt.get(...params)),
      run: (...params) => stmt.run(...params),
    };
  },
};
export default db;
