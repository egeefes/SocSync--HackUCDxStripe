# Vercel build notes

## TypeScript dependency error
Next.js detected TypeScript configuration but `@types/react` and `@types/node` were missing. They are in `devDependencies`.

## Dependencies changed in the Upstash migration
`@upstash/redis` was added to `package.json` and `node:sqlite` is no longer used. Run `npm install` once and commit the refreshed
`package-lock.json` together with `package.json` before deploying. Do not run `npm ci` until the lockfile has been refreshed.
