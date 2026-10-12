/**
 * Vercel serverless function: create or replace a manager's PIN.
 *
 *   PUT /api/pin  { username, pin }  [Bearer DAYSLEFT_API_KEY]  -> { ok: true, username }
 *
 * The caller is trusted (the owner, or Hermes's /pin command), so no old PIN is
 * needed. Setting a PIN also clears the user's failed-login counter (unlocks them)
 * and ends all of that user's existing sessions (other users are not affected).
 *
 * Self-contained like api/tasks.ts. The PIN hashing parameters must stay in sync
 * with api/login.ts.
 */
import { Redis } from '@upstash/redis';
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const USERNAME_RE = /^[a-z0-9_-]{1,32}$/;
const PIN_RE = /^\d{4,6}$/;

// Keep in sync with api/login.ts.
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

const pinKey = (username: string) => `daysleft:pin:${username}`;
// Keep in sync with api/login.ts.
const userFailKey = (username: string) => `daysleft:loginfail:user:${username}`;
// Keep in sync with api/login.ts and api/tasks.ts. Sessions store the version they were
// created under; bumping it makes every older session for this user return 401.
const sessionVersionKey = (username: string) => `daysleft:sessionver:${username}`;

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not configured');
    }
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redisClient;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isApiKey(request: Request): boolean {
  const expected = process.env.DAYSLEFT_API_KEY;
  if (!expected) return false;
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const a = createHash('sha256').update(match[1].trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function scryptAsync(pin: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export const PUT = async (request: Request): Promise<Response> => {
  try {
    if (!isApiKey(request)) {
      return json({ error: 'Unauthorized: missing or invalid "Authorization: Bearer <DAYSLEFT_API_KEY>" header' }, 401);
    }

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'Request body must be JSON: { "username": "...", "pin": "1234" }' }, 400);
    }
    const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
    const errors: string[] = [];
    if (typeof b.username !== 'string' || !USERNAME_RE.test(b.username)) {
      errors.push('"username" must be 1-32 characters of lowercase a-z, 0-9, "_" or "-"');
    }
    if (typeof b.pin !== 'string' || !PIN_RE.test(b.pin)) {
      errors.push('"pin" must be a string of 4-6 digits');
    }
    if (errors.length) return json({ error: 'Invalid request', details: errors }, 400);

    const username = b.username as string;
    const salt = randomBytes(16).toString('hex');
    const hash = (await scryptAsync(b.pin as string, salt)).toString('hex');
    // PIN first, then the version bump: see the ordering note in api/login.ts.
    await getRedis().set(pinKey(username), { salt, hash });
    await getRedis().incr(sessionVersionKey(username));
    await getRedis().del(userFailKey(username));
    return json({ ok: true, username });
  } catch (e) {
    // Never echo request data or the error message: it could contain the PIN.
    console.error('[api/pin] internal error', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Internal server error' }, 500);
  }
};
