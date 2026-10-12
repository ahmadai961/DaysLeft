/**
 * Vercel serverless function: browser login for a manager's board.
 *
 *   POST /api/login  { username, pin }  -> { token, username, expiresIn }
 *
 * Every failure (unknown user, wrong PIN, bad format, locked user or IP) returns
 * the same 401 body after the same scrypt work, so responses don't reveal which
 * usernames exist. PINs are set via PUT /api/pin.
 *
 * Self-contained like api/tasks.ts. The PIN hashing parameters must stay in sync
 * with api/pin.ts.
 */
import { Redis } from '@upstash/redis';
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const USERNAME_RE = /^[a-z0-9_-]{1,32}$/;
const PIN_RE = /^\d{4,6}$/;

// Keep in sync with api/pin.ts.
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOCK_WINDOW_SECONDS = 15 * 60;
const MAX_USER_FAILURES = 5;
const MAX_IP_FAILURES = 50;

const pinKey = (username: string) => `daysleft:pin:${username}`;
const sessionKey = (token: string) => `daysleft:session:${token}`;
// Bumped by api/pin.ts on every PIN set/reset; checked by api/tasks.ts on every request.
const sessionVersionKey = (username: string) => `daysleft:sessionver:${username}`;
// Keep in sync with api/pin.ts (which clears it on reset).
const userFailKey = (username: string) => `daysleft:loginfail:user:${username}`;
// The client IP is hashed so raw addresses are never stored.
const ipFailKey = (ip: string) =>
  `daysleft:loginfail:ip:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;

// Compared against when the user has no PIN, so unknown users cost the same work.
const DUMMY_SALT = 'daysleft-dummy-salt-0000000000000';
const DUMMY_HASH = Buffer.alloc(SCRYPT_KEYLEN);

interface StoredPin {
  salt: string;
  hash: string;
}

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

function invalidLogin(): Response {
  return json({ error: 'Invalid username or PIN' }, 401);
}

function scryptAsync(pin: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function isStoredPin(value: unknown): value is StoredPin {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.salt === 'string' && typeof v.hash === 'string';
}

function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

/**
 * Counts an attempt *before* the PIN is checked, so parallel requests can't all
 * slip under the limit. A successful login gives its attempt back (see below), so
 * the counter effectively holds recent failures. The window starts at the first
 * failure and restarts when the limit is reached, so a lock lasts 15 minutes.
 */
async function countAttempt(key: string, limit: number): Promise<number> {
  const redis = getRedis();
  const n = await redis.incr(key);
  if (n === 1 || n === limit) await redis.expire(key, LOCK_WINDOW_SECONDS);
  return n;
}

export const POST = async (request: Request): Promise<Response> => {
  try {
    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(await request.text());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
    } catch {
      // Treated like any other failed login below.
    }
    const username = typeof body.username === 'string' ? body.username : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    const validUsername = USERNAME_RE.test(username);
    const validPin = PIN_RE.test(pin);

    // Read the session version *before* the PIN. api/pin.ts writes the PIN first and
    // then bumps the version, so a login racing a reset either sees the new PIN or
    // stores a session under the old version (which is then already dead).
    const version = validUsername ? await getRedis().get(sessionVersionKey(username)) : 0;

    const ipKey = ipFailKey(clientIp(request));
    const [ipAttempts, userAttempts, stored] = await Promise.all([
      countAttempt(ipKey, MAX_IP_FAILURES),
      validUsername ? countAttempt(userFailKey(username), MAX_USER_FAILURES) : Promise.resolve(0),
      validUsername ? getRedis().get<StoredPin>(pinKey(username)) : Promise.resolve(null),
    ]);
    const locked = ipAttempts > MAX_IP_FAILURES || userAttempts > MAX_USER_FAILURES;

    // Always run scrypt once, whatever the outcome, so every path costs the same.
    const hasPin = isStoredPin(stored);
    const expected = hasPin ? Buffer.from(stored.hash, 'hex') : DUMMY_HASH;
    const actual = await scryptAsync(validPin ? pin : '000000', hasPin ? stored.salt : DUMMY_SALT);
    const pinMatches = expected.length === actual.length && timingSafeEqual(expected, actual);

    // A locked user or IP gets the generic error even with the right PIN.
    if (locked || !validUsername || !validPin || !hasPin || !pinMatches) return invalidLogin();

    const versionNumber = typeof version === 'string' ? Number(version) : version ?? 0;
    if (typeof versionNumber !== 'number' || !Number.isInteger(versionNumber)) return invalidLogin();

    const token = randomBytes(32).toString('hex');
    await getRedis().set(sessionKey(token), `${username}:${versionNumber}`, { ex: SESSION_TTL_SECONDS });
    // Success: clear the user's failures and give back this attempt on the IP counter.
    await Promise.all([
      getRedis().del(userFailKey(username)),
      ipAttempts > 1 ? getRedis().decr(ipKey) : getRedis().del(ipKey),
    ]);
    return json({ token, username, expiresIn: SESSION_TTL_SECONDS });
  } catch (e) {
    // Never echo request data or the error message: it could contain credentials.
    console.error('[api/login] internal error', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Internal server error' }, 500);
  }
};
