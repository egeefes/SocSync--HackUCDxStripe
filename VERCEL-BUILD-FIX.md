# Vercel build fix

## TypeScript dependency error

The Vercel build failed because Next.js detected TypeScript configuration but `@types/react` and `@types/node` were missing. These packages have been added to `devDependencies` in `package.json`.

After extracting this archive, run:

```bash
npm install
npm run build
```

Commit both `package.json` and the refreshed `package-lock.json`, then push to GitHub and redeploy on Vercel. Do not run `npm ci` until `package-lock.json` has been refreshed by `npm install`.

The filesystem-tracing warning in `lib/db.js` is suppressed at the flagged existence check. This only addresses tracing; it does **not** make SQLite persistent on Vercel.

## Important runtime issue

This project uses Node's built-in SQLite module and stores the database under `data/socsync.db` by default. A Vercel serverless deployment does not provide durable writable local storage. Use a persistent hosted database or a deployment platform with a persistent disk before using real accounts, bookings, or payments. Confirm the Vercel Node.js runtime is compatible with `node:sqlite`.
