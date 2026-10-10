// The one Redis connection the whole app shares (Upstash Redis, over HTTPS: works on Vercel serverless).
//
// Credentials: create an Upstash Redis database (Vercel dashboard -> Storage / Marketplace -> Upstash for Redis,
// or console.upstash.com) and set EITHER pair of variables in Vercel (and in .env.local for local use):
//   UPSTASH_REDIS_REST_URL  + UPSTASH_REDIS_REST_TOKEN     (Upstash's own names)
//   KV_REST_API_URL         + KV_REST_API_TOKEN            (what the Vercel integration adds)
// Local development with neither set falls back to a throwaway in-memory store. Production refuses to.
import { Redis } from "@upstash/redis";
import { createMemoryRedis } from "./redis-memory";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function connect() {
  if (url && token) return new Redis({ url, token });
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "Upstash Redis is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
        "(or KV_REST_API_URL and KV_REST_API_TOKEN) to the Vercel project's environment variables, then redeploy."
    );
  }
  console.warn("[redis] No Upstash credentials found: using a temporary in-memory store (dev only).");
  return createMemoryRedis();
}

// Reuse the client across hot reloads in development.
const redis = globalThis.__socsyncRedis ?? (globalThis.__socsyncRedis = connect());
export default redis;
