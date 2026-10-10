# SocSync merged build

## Merge strategy
This build uses `socsync-auth-feedback-fix` as the application foundation because it contains the broader society-admin, platform-verification, event-management, AI poster import/design, Stripe Connect, Google Calendar and moderation workflows. The iPhone-oriented Next.js 14/TypeScript snapshot is an earlier, separate implementation with a different data model and authentication contract, so copying its pages/API routes directly would break the newer SQLite schema and payment flows.

## Preserved application features
- Student sign-up and account verification queue
- Society registration and platform approval/rejection
- Society discovery, category/search/free-event filters, follow and membership flows
- Event creation/management, poster upload/design and AI poster import
- Event details, free RSVPs, paid tickets, QR-coded ticket cards
- Event and society reviews, moderation and review summaries
- AI event finder and event recommendations
- Google Calendar connect/sync
- Stripe Checkout, Stripe Connect onboarding and webhook/confirmation flows
- Society admin dashboard and SocSync platform verification dashboard
- Demo accounts and local synthetic seed data

## Added in this merge
- Reusable login modal with student/society tabs, accessible dialog semantics, Escape/backdrop close, error states and busy state
- Modal entry points from the account menu (switch account) and signup page
- iOS Safari form hardening: 16px mobile input text to prevent automatic zoom, native appearance normalization for modal inputs, safe-area-aware modal padding, dynamic viewport height and scroll containment
- App-wide loading of the extra CSS containing the modal and mobile fixes

## Important compatibility note
The older snapshot has its own JSON store, route conventions and session contract. Its saved-event/interests/committee-unlock code cannot safely be copied verbatim into this app without migrating those features to the current SQLite schema and current auth/session APIs. Features with direct equivalents are represented by the newer implementation; see `docs/MERGE_NOTES.md` before extending the remaining older-only features.

## Validation
This source merge has not been deployed. Run `npm install`, `npm run check:syntax`, `npm run test:api`, and `npm run build` in a Node.js version compatible with the `node:sqlite` API before release. Configure secrets using `.env.local`; never commit real Stripe, Google, OpenRouter or storage credentials. The README and Vercel deployment guide describe the current local SQLite persistence limitation.
