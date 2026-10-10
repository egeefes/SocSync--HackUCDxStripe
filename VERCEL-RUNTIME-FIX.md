# Vercel runtime fix

## What changed
`lib/db.js` now selects `/tmp/socsync.db` when `VERCEL` is set, instead of attempting to create `data/socsync.db` under the deployment directory (`/var/task`).

This should address the reported `ENOENT: ... mkdir '/var/task/data'` startup error caused by the app trying to create its SQLite directory inside the deployed filesystem.

## Important limitation
This is an emergency compatibility workaround, not a production database solution. Vercel function filesystems are ephemeral and separate instances may not share `/tmp`. Data, sessions, tickets, memberships, and other writes can disappear or diverge between invocations. Do not use this configuration for real users or payments.

For production, migrate the database layer to a hosted persistent database (for example, managed PostgreSQL) and replace SQLite-specific `db.prepare(...).all/get/run` operations with the selected driver's API. Simply changing the path does not make SQLite persistent.

## Deploy
1. Replace the repository contents with this project or apply the `lib/db.js` change.
2. Commit and push to the connected GitHub branch.
3. Redeploy on Vercel.
4. Check runtime logs for the original `/var/task/data` error.

The build itself must still be checked on Vercel; this patch has not been verified by a live deployment.
