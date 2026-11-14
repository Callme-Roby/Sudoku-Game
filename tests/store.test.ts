import { describe, expect, it } from 'vitest';
import { upstashCredentials } from '../lib/server/store.ts';

describe('Redis credentials from the Vercel integration', () => {
  it('reads the default KV prefix', () => {
    expect(upstashCredentials({ KV_REST_API_URL: 'https://a.upstash.io', KV_REST_API_TOKEN: 't' })).toEqual({
      url: 'https://a.upstash.io',
      token: 't',
    });
  });
  it('reads any custom prefix', () => {
    expect(
      upstashCredentials({ STORAGE_REST_API_URL: 'https://b.upstash.io', STORAGE_REST_API_TOKEN: 'u', STORAGE_URL: 'rediss://x' }),
    ).toEqual({ url: 'https://b.upstash.io', token: 'u' });
  });
  it('reads Upstash names and ignores incomplete or non-REST pairs', () => {
    expect(upstashCredentials({ UPSTASH_REDIS_REST_URL: 'https://c.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'v' })?.token).toBe('v');
    expect(upstashCredentials({ KV_REST_API_URL: 'https://d.upstash.io' })).toBeNull();
    expect(upstashCredentials({ REDIS_URL: 'redis://localhost:6379' })).toBeNull();
  });
});
