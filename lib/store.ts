import { promises as fs } from "fs";
import path from "path";
import type { DB } from "./types";

// Storage: Upstash/Vercel KV over REST when configured, otherwise a JSON file.
// The whole database is one JSON document: fine for a demo, replace with Postgres for real use.
const KEY = "campusloop:db";
const emptyDb = (): DB => ({ societyProfiles: {}, users: {}, memberships: [], tickets: [], reviews: [], events: [] });
const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const filePath = () => process.env.VERCEL ? "/tmp/campusloop-db.json" : path.join(process.cwd(), ".data", "db.json");
export const storeKind = () => (redisUrl() && redisToken() ? "redis" : process.env.VERCEL ? "ephemeral" : "file");

async function redis(cmd: string[]) {
  const res = await fetch(redisUrl()!, {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Redis request failed (${res.status})`);
  return (await res.json()).result;
}

export async function readDb(): Promise<DB> {
  try {
    const raw: string | null = storeKind() === "redis" ? await redis(["GET", KEY]) : await fs.readFile(filePath(), "utf8");
    return raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb();
  } catch (e: any) {
    if (e?.code === "ENOENT") return emptyDb();
    throw e;
  }
}

async function writeDb(db: DB) {
  const json = JSON.stringify(db);
  if (storeKind() === "redis") { await redis(["SET", KEY, json]); return; }
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, json);
  await fs.rename(tmp, file);
}

// Writes are serialised within one server instance. Across instances this is last-write-wins.
let queue: Promise<unknown> = Promise.resolve();
export function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const out = fn(db);
    await writeDb(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}
