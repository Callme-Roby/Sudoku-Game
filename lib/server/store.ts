/**
 * Minimal key/value store for rooms.
 *  - Production (Vercel): Upstash Redis over its REST API. The Vercel Marketplace
 *    integration sets KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
 *  - Local dev: an in-memory fallback (single process only).
 */

type Cmd = (string | number)[];

export interface Store {
  exec(cmds: Cmd[]): Promise<unknown[]>;
}

class UpstashStore implements Store {
  constructor(
    private url: string,
    private token: string,
  ) {}
  async exec(cmds: Cmd[]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`store: ${res.status} ${await res.text()}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => {
      if (r.error) throw new Error(`store: ${r.error}`);
      return r.result;
    });
  }
}

type ZSet = { kind: 'zset'; scores: Map<string, number> };

interface Entry {
  value: string | Map<string, string> | ZSet;
  expires: number;
}

/** Implements just the commands the rooms use. */
class MemoryStore implements Store {
  private data = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const e = this.data.get(key);
    if (e && e.expires && e.expires < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private hash(key: string): Map<string, string> {
    const e = this.live(key);
    if (e && e.value instanceof Map) return e.value;
    const m = new Map<string, string>();
    this.data.set(key, { value: m, expires: e?.expires ?? 0 });
    return m;
  }

  private zset(key: string, create = false): ZSet | null {
    const e = this.live(key);
    if (e && typeof e.value === 'object' && 'kind' in e.value) return e.value;
    if (!create) return null;
    const z: ZSet = { kind: 'zset', scores: new Map() };
    this.data.set(key, { value: z, expires: e?.expires ?? 0 });
    return z;
  }

  /** members sorted by score, then member (Redis order) */
  private sorted(z: ZSet | null): [string, number][] {
    if (!z) return [];
    return [...z.scores.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  async exec(cmds: Cmd[]): Promise<unknown[]> {
    return cmds.map(([name, key, ...args]) => {
      const k = String(key);
      switch (String(name).toUpperCase()) {
        case 'GET': {
          const e = this.live(k);
          return e && typeof e.value === 'string' ? e.value : null;
        }
        case 'SET': {
          const opts = args.slice(1).map(String);
          if (opts.includes('NX') && this.live(k)) return null;
          const ex = opts.indexOf('EX');
          this.data.set(k, {
            value: String(args[0]),
            expires: ex >= 0 ? Date.now() + Number(opts[ex + 1]) * 1000 : 0,
          });
          return 'OK';
        }
        case 'HSET': {
          const h = this.hash(k);
          for (let i = 0; i < args.length; i += 2) h.set(String(args[i]), String(args[i + 1]));
          return 1;
        }
        case 'HGETALL': {
          const e = this.live(k);
          if (!e || !(e.value instanceof Map)) return [];
          return [...e.value.entries()].flat();
        }
        case 'HDEL': {
          const e = this.live(k);
          if (!e || !(e.value instanceof Map)) return 0;
          let n = 0;
          for (const f of args) if (e.value.delete(String(f))) n++;
          return n;
        }
        case 'HMGET': {
          const e = this.live(k);
          const h = e && e.value instanceof Map ? e.value : new Map<string, string>();
          return args.map((f) => h.get(String(f)) ?? null);
        }
        case 'DEL': {
          return [k, ...args.map(String)].reduce((n, x) => n + (this.data.delete(x) ? 1 : 0), 0);
        }
        case 'ZADD': {
          const z = this.zset(k, true)!;
          let i = 0;
          const flags = new Set<string>();
          while (['LT', 'GT', 'NX', 'XX'].includes(String(args[i]).toUpperCase())) flags.add(String(args[i++]).toUpperCase());
          let added = 0;
          for (; i + 1 < args.length; i += 2) {
            const score = Number(args[i]);
            const member = String(args[i + 1]);
            const cur = z.scores.get(member);
            if (cur === undefined) {
              if (flags.has('XX')) continue;
              z.scores.set(member, score);
              added++;
            } else if (!flags.has('NX')) {
              if (flags.has('LT') && score >= cur) continue;
              if (flags.has('GT') && score <= cur) continue;
              z.scores.set(member, score);
            }
          }
          return added;
        }
        case 'ZRANGE': {
          const list = this.sorted(this.zset(k));
          const n = list.length;
          let start = Number(args[0]);
          let stop = Number(args[1]);
          if (start < 0) start += n;
          if (stop < 0) stop += n;
          const slice = list.slice(Math.max(0, start), stop + 1);
          return String(args[2] ?? '').toUpperCase() === 'WITHSCORES'
            ? slice.flatMap(([m, sc]) => [m, String(sc)])
            : slice.map(([m]) => m);
        }
        case 'ZRANK': {
          const i = this.sorted(this.zset(k)).findIndex(([m]) => m === String(args[0]));
          return i < 0 ? null : i;
        }
        case 'ZSCORE': {
          const v = this.zset(k)?.scores.get(String(args[0]));
          return v === undefined ? null : String(v);
        }
        case 'ZCARD':
          return this.zset(k)?.scores.size ?? 0;
        case 'ZREMRANGEBYRANK': {
          const z = this.zset(k);
          if (!z) return 0;
          const list = this.sorted(z);
          const n = list.length;
          let start = Number(args[0]);
          let stop = Number(args[1]);
          if (start < 0) start += n;
          if (stop < 0) stop += n;
          const gone = list.slice(Math.max(0, start), stop + 1);
          for (const [m] of gone) z.scores.delete(m);
          return gone.length;
        }
        case 'EXPIRE': {
          const e = this.live(k);
          if (!e) return 0;
          e.expires = Date.now() + Number(args[0]) * 1000;
          return 1;
        }
        default:
          throw new Error(`memory store: unsupported ${name}`);
      }
    });
  }
}

const g = globalThis as unknown as { __sudokuStore?: Store };

/**
 * Upstash REST credentials, whatever prefix the Vercel integration was given:
 * KV_REST_API_URL / KV_REST_API_TOKEN (default), <PREFIX>_REST_API_URL / _TOKEN
 * (custom prefix) or UPSTASH_REDIS_REST_URL / _TOKEN (Upstash's own integration).
 */
export function upstashCredentials(env: Record<string, string | undefined> = process.env) {
  const candidates: [string, string][] = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ];
  for (const key of Object.keys(env).sort()) {
    const custom = /^(.+)_REST_API_URL$/.exec(key);
    if (custom) candidates.push([key, `${custom[1]}_REST_API_TOKEN`]);
    const upstash = /^(.+)_REDIS_REST_URL$/.exec(key);
    if (upstash) candidates.push([key, `${upstash[1]}_REDIS_REST_TOKEN`]);
  }
  for (const [u, t] of candidates) {
    const url = env[u];
    const token = env[t];
    if (url?.startsWith('https://') && token) return { url, token };
  }
  return null;
}

export function store(): Store {
  if (g.__sudokuStore) return g.__sudokuStore;
  const creds = upstashCredentials();
  if (creds) {
    g.__sudokuStore = new UpstashStore(creds.url, creds.token);
  } else {
    if (process.env.VERCEL) {
      console.warn('[sudoku] no Redis configured: rooms and leaderboards live in memory and are not shared between instances.');
    }
    g.__sudokuStore = new MemoryStore();
  }
  return g.__sudokuStore;
}

/** Redis HGETALL comes back as a flat [field, value, …] list. */
export function pairs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
  else if (raw && typeof raw === 'object') Object.assign(out, raw);
  return out;
}
