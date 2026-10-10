# SocSync — UCD student life

A Next.js 14 society and event discovery platform for UCD students, with society pages, paid memberships, tickets, reviews, interest-based recommendations and a calendar. Built for a hackathon: seed content is fictional, and auth is a demo stand-in (see "Before production").

## What's included

**For students**
- Discover events (search, category filter, free-only, saved events) and an AI event finder (OpenRouter, with keyword fallback)
- Pick **interests** at `/interests`; get recommended events and societies on Discover and Societies
- **Society pages** (`/societies/[id]`): bio, committee members, social links, upcoming events, ratings and reviews
- **Join a society for €2** (Stripe test checkout). After payment the signup is *pending* until the committee confirms it
- **My societies** (`/my-societies`): membership cards (pending or active) and every ticket you've bought or reserved, each with a ticket code and QR
- **Events** (`/events/[id]`): live "going" count and capacity bar, free reservations, paid tickets, reviews
- **Calendar** (`/calendar`): month view of the events you're going to
- **Reviews and ratings**, separate for events and for societies. One per student per target; posting again edits it. Reviewers with a ticket or confirmed membership get an "Attended" or "Member" badge

**For committees** (`/committee`)
- See new signups with name, email and **student number**, and confirm them
- See confirmed members
- Edit your society page's cover image, bio, tagline, committee member profiles and social links
- Post events for your society (price, capacity, date) and see tickets sold
- Students must have a confirmed membership in an event's society before reserving or buying an event ticket

## Run locally

Node.js 18.17+ (Node 20 LTS recommended).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Data is stored in `.data/db.json` (git-ignored). Delete that folder to reset.

Try it:
1. Sign in at `/signin` with any email and any 8-digit student number. Don't use a real student number.
2. Pick interests, reserve a free event, review it.
3. Open the avatar menu → **Committee access**, choose a society, and enter the passcode (`committee` locally) to confirm members.
4. To see the full join flow you need Stripe test keys (below). Without them, paid actions show a "not configured" message.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs the session cookie. **Required in production.** |
| `COMMITTEE_PASSCODE` | Shared demo passcode for committee tools. **Required in production.** |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Persistence on Vercel (Upstash Redis / Vercel KV). `UPSTASH_REDIS_REST_*` also works |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI event finder |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` | Test-mode payments |

### Persistence
All data (users, memberships, tickets, reviews, committee-created events) lives in one JSON document. Locally it's a file. On Vercel the filesystem is ephemeral, so **add an Upstash Redis / Vercel KV store** from the Vercel Marketplace, or data will disappear between requests. Writes are serialised within an instance and last-write-wins across instances, which is fine for a demo but not for real traffic. Move to Postgres/Supabase for that.

### Stripe test checkout
1. Use **test mode**. Put your `sk_test_...` key in `.env.local` as `STRIPE_SECRET_KEY`.
2. Open an event with a price, or a society page, and choose **Buy ticket** or **Join society**.
3. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.

Prices are set on the server (event price, or €2 membership). The browser never sends an amount. Checkout needs at least €0.50.

**How payments are recorded.** A paid session is recorded in two places, idempotently: the webhook (`checkout.session.completed`) and the `/success` page, which retrieves the session from Stripe and checks `payment_status === "paid"`. So bookings appear even before you've set up webhooks, and Stripe retries or the success page reloading can't create duplicates (keyed on session ID and on student + target).

Local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` and restart.

### OpenRouter
Add `OPENROUTER_API_KEY` to enable AI picks. The server loads events from the database itself (the browser only sends the prompt), validates the returned IDs, and shows the model's reason on each card. Without a key it falls back to keyword matching and says so. The endpoint is rate-limited per instance (8 requests/minute/IP); use a shared limiter in production.

## Deploy to Vercel
1. Push to GitHub and import at https://vercel.com/new.
2. Add an Upstash Redis / Vercel KV store to the project (sets `KV_REST_API_*`).
3. Add `SESSION_SECRET`, `COMMITTEE_PASSCODE`, `NEXT_PUBLIC_APP_URL` (exact deployed URL, no trailing slash), and your Stripe / OpenRouter keys.
4. In Stripe → Developers → Webhooks add `https://YOUR-DOMAIN/api/stripe-webhook`, subscribe to `checkout.session.completed`, copy the signing secret to `STRIPE_WEBHOOK_SECRET`, and redeploy.

Never use a live Stripe key for the hackathon demo.

## How the numbers work
- **Going** = free reservations + paid tickets on SocSync, **plus** an illustrative baseline for the seeded events (`baseGoing`). New events start at 0.
- **Members** = illustrative baseline for each seeded society + confirmed memberships on SocSync.
- Capacity is enforced when reserving and when starting checkout. A student who has already paid is never turned away, so concurrent checkouts can slightly oversell.
- Seeded events are dated 15 to 23 Oct 2026. After that they appear as past events; add new ones from the committee dashboard.

## Before production
This is a hackathon prototype, not a membership or ticketing system.
- **Auth is a demo.** Sign-in is email + student number with no verification, so anyone who knows someone's email and student number can act as them. Replace with UCD SSO or email magic links.
- **Committee access is one shared passcode** that unlocks any society. Replace with per-society roles assigned by the society.
- Membership payments need refund and rejection handling: a committee can confirm a signup but can't yet decline or refund one.
- Paid tickets can't be cancelled in-app (free reservations can).
- Add ticket check-in (scan the QR), email receipts, and a privacy policy and terms. Student numbers are personal data, so only committees see them, but you still need consent, retention and GDPR handling.
- Committee-editable society profiles are stored in the demo JSON database. Verify committee identity and validate uploaded media/links before production.
- Move storage to a real database and the rate limiter to a shared store.
- Society names, committee members, social handles, events and baseline numbers are fictional demo content, not verified UCD listings. Images load from Unsplash.
