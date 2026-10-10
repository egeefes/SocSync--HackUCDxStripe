// In-memory stand-in for Upstash Redis, used ONLY for local development when no Upstash credentials
// are set (and never in production). It implements just the commands SocSync uses and mimics the
// real client's JSON auto-(de)serialisation, so the app behaves the same either way.
// Data lives in the Node process: restart the dev server and it is gone (and re-seeded).

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function createMemoryRedis() {
  const strings = new Map(); // key -> { value, expires }
  const hashes = new Map(); // key -> Map(field -> value)

  const live = (key) => {
    const e = strings.get(key);
    if (e && e.expires && e.expires < Date.now()) {
      strings.delete(key);
      return undefined;
    }
    return e;
  };
  const hash = (key, create = false) => {
    let h = hashes.get(key);
    if (!h && create) hashes.set(key, (h = new Map()));
    return h;
  };

  const api = {
    async get(key) {
      const e = live(key);
      return e ? clone(e.value) : null;
    },
    async set(key, value, opts = {}) {
      if (opts.nx && live(key)) return null;
      strings.set(key, { value: clone(value), expires: opts.ex ? Date.now() + opts.ex * 1000 : 0 });
      return "OK";
    },
    async del(...keys) {
      let n = 0;
      for (const k of keys) n += (strings.delete(k) ? 1 : 0) + (hashes.delete(k) ? 1 : 0);
      return n;
    },
    async incr(key) {
      const next = Number(live(key)?.value ?? 0) + 1;
      strings.set(key, { value: next, expires: 0 });
      return next;
    },
    async hget(key, field) {
      const v = hash(key)?.get(String(field));
      return v === undefined ? null : clone(v);
    },
    async hset(key, obj) {
      const h = hash(key, true);
      let added = 0;
      for (const [f, v] of Object.entries(obj)) {
        if (!h.has(f)) added++;
        h.set(f, clone(v));
      }
      return added;
    },
    async hsetnx(key, field, value) {
      const h = hash(key, true);
      if (h.has(String(field))) return 0;
      h.set(String(field), clone(value));
      return 1;
    },
    async hdel(key, ...fields) {
      const h = hash(key);
      return h ? fields.reduce((n, f) => n + (h.delete(String(f)) ? 1 : 0), 0) : 0;
    },
    async hexists(key, field) {
      return hash(key)?.has(String(field)) ? 1 : 0;
    },
    async hkeys(key) {
      return [...(hash(key)?.keys() ?? [])];
    },
    async hvals(key) {
      return [...(hash(key)?.values() ?? [])].map(clone);
    },
    async scan(cursor, { match } = {}) {
      const re = match ? new RegExp("^" + match.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$") : null;
      const all = [...strings.keys(), ...hashes.keys()].filter((k) => !re || re.test(k));
      return ["0", all];
    },
    pipeline() {
      const queue = [];
      const p = new Proxy(
        {},
        {
          get: (_t, name) => {
            if (name === "exec") return async () => Promise.all(queue.map((fn) => fn()));
            return (...args) => {
              queue.push(() => api[name](...args));
              return p;
            };
          },
        }
      );
      return p;
    },
  };
  return api;
}
