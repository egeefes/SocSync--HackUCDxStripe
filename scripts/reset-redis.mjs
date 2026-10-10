// Deletes every socsync:* key in your Upstash Redis database. The next page load re-creates the demo data.
//   Local:  set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or put them in .env.local), then  npm run reset-db
// Refuses to run unless you confirm, because this wipes real accounts, tickets and payments too.
import { Redis } from "@upstash/redis";
import fs from "node:fs";

// Minimal .env.local reader so `npm run reset-db` works without extra tooling.
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.error("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first (Upstash console -> your database -> REST API).");
  process.exit(1);
}
if (process.argv[2] !== "--yes") {
  console.error(`This deletes ALL SocSync data in ${url}.\nRun again with --yes to confirm:  npm run reset-db -- --yes`);
  process.exit(1);
}

const redis = new Redis({ url, token });
let cursor = "0";
let deleted = 0;
do {
  const [next, found] = await redis.scan(cursor, { match: "socsync:*", count: 200 });
  cursor = String(next);
  if (found.length) deleted += await redis.del(...found);
} while (cursor !== "0");
console.log(`Deleted ${deleted} keys. Demo data is re-created on the next page load.`);
