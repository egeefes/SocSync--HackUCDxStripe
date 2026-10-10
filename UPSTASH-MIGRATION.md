# SQLite -> Upstash Redis migration

## Before you deploy
1. `npm install` (adds `@upstash/redis`), then commit `package.json` AND `package-lock.json`.
2. In Vercel: Storage -> create/connect **Upstash for Redis**. Confirm the project has `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_URL` / `KV_REST_API_TOKEN` pair). Set `APP_URL` too.
3. Redeploy. If Redis variables are missing in production the app throws a clear error instead of silently losing data.

## How login works now
- `POST /api/auth/login` -> `lib/db.js` looks the email up in the `socsync:idx:users_email` hash -> checks the scrypt hash.
- `startSession()` creates `socsync:session:<random token>` = user id with a 30-day expiry (EX) in Redis and puts only the token in
  the httpOnly `sid` cookie (Secure on Vercel).
- `getCurrentUser()` reads the cookie -> `GET socsync:session:<token>` -> `HGET socsync:t:users <id>`. Logout deletes the key.
- `proxy.js` is unchanged: it only checks that the cookie exists; pages and APIs verify it against Redis.

## What moved
Everything that was SQL (`db.prepare/exec`) now goes through `lib/db.js`: users, sessions, societies, events, follows, RSVPs,
payments, reviews, society reviews, posters and society pictures, AI review-summary cache, Google Calendar links.
Joins/filters/sorting from the old SQL happen in `lib/queries.js`, which loads the small tables it needs in one pipelined round trip.
All query functions are now async (`await` them). `lib/seed.js` holds the demo data and runs once on an empty database.

## Behaviour notes / limits
- No multi-key transactions. Uniqueness (student number, email, Stripe session, one review per event, one RSVP) uses atomic
  HSETNX; counters use INCR. Capacity checks (RSVP / tickets) and `ai_imports_used` are read-then-write and can race under heavy
  simultaneous use. Fine for a prototype; use Lua/`MULTI` if it matters.
- Queries read whole tables (`HVALS`) and join in memory. Fine at hundreds of rows; at thousands, add per-user / per-society index sets.
- Pictures and posters are base64 inside Redis (Upstash caps a single value at 100 MB, but keep them small; upload limits are unchanged).
- `npm run reset-db -- --yes` deletes every `socsync:*` key. Seeded event dates are relative to the first run, so reset occasionally
  if the demo events go stale.
- Google refresh tokens are stored unencrypted (as before); encrypt before launch.
- Not verified against a live Upstash database or a Vercel build from this environment (no network). The data layer was tested
  against an in-memory Redis stand-in; run `npm run build` and `npm run test:api` before relying on it.
