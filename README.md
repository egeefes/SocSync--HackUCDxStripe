# SocSync: every UCD society event in one calendar

**HackUCD 2026 · Theme: Everyday Frustrations (with a FinTech crossover)**

**The problem:** UCD has dozens of societies, but there's no single place to see what's on this week. If you're not a member you have to scroll each society's Instagram, and some societies don't post there at all. You also can't tell which societies run good events before you join.

**SocSync:**
- Societies publish their events once, into a shared calendar.
- Students follow societies, filter by interest (languages, business, outdoors…), RSVP, buy tickets and join societies.
- Only students who actually attended an event can rate it.

## Merged build and login modal

This archive includes the reusable login modal and iOS Safari form fixes. See [docs/MERGE_NOTES.md](docs/MERGE_NOTES.md) for merge scope, compatibility notes and validation steps.

## Vercel deployment

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for Blob setup and the current deployment limitations. Society profile images and event posters can use Vercel Blob, but the database is still local SQLite; **this version is not yet safe for production deployment on Vercel** until the PostgreSQL migration is completed.

## Quick start

1. Install Node.js 22.13+ (we use the built-in `node:sqlite`, so there's no database to install).
2. Install the libraries:
   ```bash
   npm install
   ```
3. Create your local settings file:
   ```bash
   cp .env.example .env.local
   ```
   Then add your OpenRouter and Stripe **sandbox** keys to `.env.local`.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000.

The first page load creates `data/socsync.db` with **synthetic demo data**. To start fresh, stop the server, then run:
```bash
npm run reset-db
```

The app opens on the **login page**, and nothing else is visible until you log in. Pick the **Student** or **Society** tab, then use a **one-click demo account** or your own email and password. New students click *Create a student account*. New societies click *Register your society*, which creates the applicant's account and the society application in one form.

**Students** land on their home page:
- **My societies:** paid memberships (*Member ✓*) and followed societies, each with its next event.
- A **Find societies** search, plus the calendar.

Each society has a **home page** with a **Become a member** box. A student pays the membership fee, e.g. €2/year, through Stripe Checkout and becomes a member. **Society admins** land on their dashboard, which lists their paid members.

## Accounts & verification

| Who | How they join | What's checked |
|---|---|---|
| **Student** | Sign up: name, 8-digit student number, `@ucdconnect.ie` email, password | Starts **pending**: can browse and follow, but RSVPs, tickets and reviews unlock after the SocSync admin verifies them. *At launch: "Sign in with Google", limited to @ucdconnect.ie accounts, verifies students automatically.* |
| **Society** | A student fills in **Register a society**: details, their committee role, and evidence | Hidden until the **SocSync admin** checks the Students' Union list and the applicant's committee role. Approving makes it public and the applicant its admin. Rejections include a reason, and the student can re-apply. |
| **SocSync admin** | Demo account "SocSync Admin (you)" | Reviews both queues at **Verification requests** (`/platform`) |

- Passwords are hashed with scrypt and a random salt.
- Sessions are random tokens in an httpOnly cookie.
- Demo accounts have no password and can only be entered through the demo buttons.

**Stripe test card:** `4242 4242 4242 4242`, any future expiry date, any CVC.

## How it's built

```
Browser (React pages)  ──fetch──▶  Next.js API routes (app/api/*)  ──▶  SQLite file (data/socsync.db)
                                            │
                                            ├──▶ OpenRouter (AI: poster → event, moderation, summaries)
                                            └──▶ Stripe sandbox (Checkout: Pro, tickets, memberships; Connect payouts)
```

One Next.js project holds both the **frontend** (`app/**/page.js`, `components/`) and the **backend** (`app/api/**/route.js`, `lib/`).

| Feature | Where |
|---|---|
| Calendar (my societies / all), search, category filter | `app/page.js`, `components/Calendar.js`, `components/FilterBar.js`, `lib/queries.js` |
| Browse & follow societies | `app/societies/page.js`, `app/api/follow` |
| Society page, membership, reviews | `app/societies/[id]/page.js` |
| Event page, RSVP, tickets, rating | `app/events/[id]/page.js`, `app/api/rsvp`, `app/api/reviews` |
| Society dashboard | `app/admin/page.js`, `components/EventForm.js` |
| **AI 1:** poster / caption → event | `lib/ai-features.js#extractEvent`, `app/api/ai/import-event` |
| **AI 2:** review moderation (keeps criticism, blocks abuse) | `lib/ai-features.js#moderateReview`, `app/api/reviews` |
| **AI 3:** "what students say" summary | `lib/ai-features.js#summariseReviews`, `app/api/ai/review-summary` |
| **AI 4:** "What's your kind of thing?" event finder | `lib/ai-features.js#findEvents`, `app/api/ai/find-events`, `components/AiFinder.js` |
| **AI 5:** event form → AI-designed poster (AI writes copy + paints picture; app draws exact details) | `lib/ai-features.js#designPoster`, `lib/openrouter.js#generateImage`, `app/api/ai/design-poster`, `lib/poster-canvas.js`, `components/PosterDesigner.js` |
| Society profiles: logo, cover banner, card background, about us, committee | `components/SocietyProfileEditor.js`, `app/api/societies/profile`, `app/api/societies/[id]/image/[kind]`, `components/SocietyAvatar.js` |
| Reviews of a society (members / attendees; post again to edit; delete) | `app/api/societies/[id]/reviews`, `components/SocietyReviewForm.js`, `lib/queries.js#societyReviewBlockReason` |
| Tickets with QR codes: paid (Stripe) + free reserved (RSVP) | `components/TicketCard.js`, `app/my-societies`, `app/events/[id]` |
| Edit / delete / repeat events (Google Calendar of attendees kept in sync) | `components/EventsManager.js`, `app/api/events/[id]`, `lib/events.js` |
| **Stripe:** checkout, confirmation, webhook, Connect | `lib/stripe.js`, `app/api/stripe/*` |
| Database schema + demo data | `lib/db.js` |
| Accounts, sessions, verification | `lib/session.js`, `app/api/auth/*`, `app/signup`, `app/login`, `app/register-society`, `app/platform`, `app/api/platform/review` |

## Business model (Stripe bonus)

| What | Price | Who pays | Why it fits |
|---|---|---|---|
| **SocSync Pro** (subscription) | €5 / month | Society | Unlimited AI poster imports. The free plan gets 3, then the society upgrades. It saves committee time every week, and €5 is far less than a society's printing budget. |
| Event tickets | Set by the society (e.g. Ball €30, trip €20) | Student | Money goes to the society's Stripe Connect account. SocSync keeps 5%. |
| Membership | Set by the society (e.g. €3/year) | Student | Same as tickets: join a society without queueing at a stand. |

**How a payment is confirmed:**
1. Checkout is Stripe-hosted.
2. On return, `/api/stripe/confirm` **retrieves the session from Stripe** and only acts if `status=complete` and `payment_status=paid`.
3. It then activates Pro, records the ticket (which counts as an RSVP), or records the membership.

`payments.stripe_session_id` is UNIQUE, so a payment can never be recorded twice, even if the redirect and the webhook both arrive. Only `sk_test_` keys are accepted.

## Testing

```bash
npm run test:api
```

This runs 48 ordinary, boundary and failure cases against a running dev server on a fresh database. Run it after `npm run reset-db`. See [docs/EVIDENCE.md](docs/EVIDENCE.md) for what we tested and learned.

## Data

- All students, events, reviews and payments are **synthetic**, generated in `lib/db.js`.
- Society names and descriptions are fictional placeholders, to be replaced with pilot societies that consent.
- Event dates are generated relative to today, so the demo always has upcoming and past events.

## Team workflow

- `main` must always run. Work on `feature/<name>` branches and merge back every 45–60 minutes.
- One owner for `lib/db.js` (the schema), to avoid merge conflicts.
- Never commit `.env.local`.
