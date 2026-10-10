# Vercel deployment status and setup

## Persistent file uploads

SocSync now stores society profile images and event posters in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set. Existing local development remains compatible with data URLs.

1. In the Vercel project, open **Storage** and create a **Blob** store.
2. Connect it to the project and ensure `BLOB_READ_WRITE_TOKEN` exists in Development, Preview, and Production.
3. Redeploy after adding the variable.
4. Upload a society avatar/cover/card image and create an event with a poster to verify.

Blob URLs are saved in the existing `image_data` fields. The image routes redirect to those URLs, while legacy local data URLs continue to work.

## Important: database migration is still required before production use

The current `lib/db.js` imports Node's `node:sqlite` and stores the database in `data/socsync.db`. That file is not durable shared storage on Vercel serverless functions: it can be discarded between invocations and is not shared consistently across instances. Adding Redis environment variables does not fix this because the application executes SQL statements synchronously throughout pages, API routes, and helper modules.

**Do not deploy this revision as a production-ready application yet.** Before production, migrate the full schema and all SQL callers to a hosted PostgreSQL database (recommended: Neon), including sessions, users, society/event data, RSVPs, reviews, payments, AI summaries, media URLs, and Google Calendar mappings. Convert transactions and data access to async calls and run the API test suite against the hosted database. No automatic production database migration is run by this project.

## Required secrets

Use Vercel Project Settings → Environment Variables. Never commit secrets or paste them into source code.

- `BLOB_READ_WRITE_TOKEN` — required for cloud uploads.
- `OPENROUTER_API_KEY` — AI features.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — Stripe, with live keys only after payment testing.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — optional Google Calendar sync; configure the production callback as `https://YOUR_DOMAIN/api/google/callback`.

The existing application currently restricts Stripe keys to test mode. Review that intentional guard separately before going live.


## Immediate SQLite runtime error (`ENOENT: /var/task/data`)

The SQLite path now uses `/tmp/socsync.db` on Vercel because `/var/task` is read-only.
This prevents the specific `mkdir '/var/task/data'` crash, but it is only a temporary
runtime workaround: `/tmp` is ephemeral and isolated per serverless instance. Data may
disappear between invocations/deployments and concurrent requests may see different
databases. Do not use this fallback for real users or payments. A full production fix
still requires migrating the synchronous SQLite data access throughout `lib/db.js`,
API routes, and server-rendered pages to a persistent PostgreSQL database (e.g. Neon).
