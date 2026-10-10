# Merge notes

This build combines the feature-rich `socsync-main` implementation with the responsive layout fixes from
`SocSync-iphone-asterisk-fix`.

## Included application features

- Event discovery, category/search/free filters, calendar and event detail pages
- Society directory, society detail pages, follows and paid memberships
- RSVPs, ticketing, Stripe checkout/webhooks and society Stripe Connect flows
- Reviews, review moderation and review summaries
- AI event finder, poster/caption event import, and AI poster design
- Society profile editing, image uploads, society registration and platform review queue
- Google Calendar connection/sync
- Society admin dashboard and event management
- Responsive/iPhone fixes for society headers, event cards, forms, calendars and ticket cards

## Authentication

The feature source's existing authentication implementation is retained because the feature pages and APIs
depend on its session and user model. No new authentication feature was added as part of the CSS/feature
port. The first archive's authentication endpoints cannot be dropped in directly: they use a different
user/session/database model.

## Database

This merge originally used `node:sqlite`. It has since been migrated to Upstash Redis so data persists on Vercel;
see `UPSTASH-MIGRATION.md`. Configure the environment variables in `.env.example` in Vercel, use Stripe test mode until
webhooks are verified, and never commit `.env.local` or live secrets.

## Validation

Source files and styles were merged. Run `npm install` and `npm run build` in the project directory before
deploying. A successful source merge does not prove live Vercel behavior or production data persistence.
