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

interface Entry {
  value: string | Map<string, string>;
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

export function store(): Store {
  if (g.__sudokuStore) return g.__sudokuStore;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    g.__sudokuStore = new UpstashStore(url, token);
  } else {
    if (process.env.VERCEL) {
      console.warn('[sudoku] no Redis configured: multiplayer rooms live in memory and will not be shared between instances.');
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
