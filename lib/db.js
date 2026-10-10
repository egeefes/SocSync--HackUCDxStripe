// Database: Upstash Redis (see lib/redis.js). Replaces the old SQLite file, which cannot persist on Vercel.
//
// Data model
//   Every "table" is ONE Redis hash:  socsync:t:<table>   field = row id (or a composite key)  value = the row as JSON.
//   Row ids come from an atomic counter:   socsync:seq:<table>   (INCR)
//   Unique lookups (email, student number, Stripe session) are small hashes:  socsync:idx:<name>   (HSETNX = atomic).
//   Login sessions are plain keys with a built-in expiry:   socsync:session:<token> -> user id   (EX 30 days)
//   Rows keep the same column names the SQL tables had, so pages and components are unchanged.
//
// The first request on an empty database fills it with SYNTHETIC demo data (lib/seed.js).
// To start fresh: `npm run reset-db` (deletes every socsync:* key).
import redis from "./redis";
import { seedDatabase } from "./seed";

export const CATEGORIES = [
  "Languages & Culture",
  "Business",
  "Sport & Outdoors",
  "Arts & Performance",
  "Academic & Tech",
  "Social & Hobbies",
];

export const COMMITTEE_ROLES = ["Auditor", "Chairperson", "Secretary", "Treasurer", "PRO", "Other committee member"];

const P = "socsync:";
export const keys = {
  table: (t) => `${P}t:${t}`,
  seq: (t) => `${P}seq:${t}`,
  index: (n) => `${P}idx:${n}`,
  session: (token) => `${P}session:${token}`,
  ready: `${P}ready`,
  lock: `${P}seed-lock`,
};

// ---------- first-run set-up ----------
// One instance seeds; any others that start at the same moment wait for it.
async function setUp() {
  if (await redis.get(keys.ready)) return;
  if (await redis.set(keys.lock, "1", { nx: true, ex: 60 })) {
    try {
      await seedDatabase(redis, keys);
      await redis.set(keys.ready, "1");
    } finally {
      await redis.del(keys.lock);
    }
    return;
  }
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await redis.get(keys.ready)) return;
  }
  throw new Error("The database is still being set up. Refresh in a few seconds.");
}

function ready() {
  const g = globalThis;
  g.__socsyncReady ??= setUp().catch((err) => {
    g.__socsyncReady = null; // try again on the next request
    throw err;
  });
  return g.__socsyncReady;
}

// ---------- the tiny data API ----------
// table = "users" | "societies" | "events" | ...    field = row id or composite key like "<user_id>:<event_id>"
const db = {
  // All rows of a table (array, unordered: sort in JS).
  async all(table) {
    await ready();
    return (await redis.hvals(keys.table(table))) ?? [];
  },

  // Several tables in ONE round trip: const { events, rsvps } = await db.load(["events", "rsvps"]);
  async load(tables) {
    await ready();
    const p = redis.pipeline();
    for (const t of tables) p.hvals(keys.table(t));
    const res = await p.exec();
    return Object.fromEntries(tables.map((t, i) => [t, res[i] ?? []]));
  },

  async get(table, field) {
    await ready();
    return (await redis.hget(keys.table(table), String(field))) ?? null;
  },

  async getMany(table, fields) {
    await ready();
    if (!fields.length) return [];
    const p = redis.pipeline();
    for (const f of fields) p.hget(keys.table(table), String(f));
    return (await p.exec()).filter(Boolean);
  },

  async has(table, field) {
    await ready();
    return (await redis.hexists(keys.table(table), String(field))) === 1;
  },

  // Field names only (cheap: no row data). Used to ask "does this event have a poster?".
  async fields(table) {
    await ready();
    return (await redis.hkeys(keys.table(table))) ?? [];
  },

  // Create or replace the row at `field`.
  async set(table, field, row) {
    await ready();
    await redis.hset(keys.table(table), { [String(field)]: row });
    return row;
  },

  // Create the row only if `field` is free. Returns true if it was created (atomic).
  async setIfAbsent(table, field, row) {
    await ready();
    return (await redis.hsetnx(keys.table(table), String(field), row)) === 1;
  },

  // Delete a row. Returns how many were removed (0 or 1), like SQL's `changes`.
  async delete(table, field) {
    await ready();
    return await redis.hdel(keys.table(table), String(field));
  },

  // New row with the next auto-increment id.
  async insert(table, row) {
    await ready();
    const id = await redis.incr(keys.seq(table));
    const full = { id, ...row };
    await redis.hset(keys.table(table), { [String(id)]: full });
    return full;
  },

  // Merge `patch` into an existing row. Returns the new row, or null if it doesn't exist.
  async update(table, field, patch) {
    const row = await db.get(table, field);
    if (!row) return null;
    const next = { ...row, ...patch };
    await redis.hset(keys.table(table), { [String(field)]: next });
    return next;
  },

  // ----- unique lookups (email -> user id, ...) -----
  async lookup(index, key) {
    await ready();
    return (await redis.hget(keys.index(index), String(key))) ?? null;
  },
  async claim(index, key, value) {
    await ready();
    return (await redis.hsetnx(keys.index(index), String(key), value)) === 1;
  },
  async release(index, key) {
    await ready();
    await redis.hdel(keys.index(index), String(key));
  },
  async nextId(table) {
    await ready();
    return await redis.incr(keys.seq(table));
  },

  // ----- login sessions (expire by themselves) -----
  async createSession(token, userId, ttlSeconds) {
    await ready();
    await redis.set(keys.session(token), userId, { ex: ttlSeconds });
  },
  async sessionUserId(token) {
    await ready();
    return (await redis.get(keys.session(token))) ?? null;
  },
  async deleteSession(token) {
    await ready();
    await redis.del(keys.session(token));
  },
};

export default db;
