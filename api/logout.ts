/**
 * Vercel serverless function: end the caller's own browser session.
 *
 *   POST /api/logout  [Bearer <session token>]  -> { ok: true }
 *
 * Deletes daysleft:session:{token} for the token in the Authorization header only;
 * other sessions (same user or not) are untouched. Idempotent: an already expired
 * or unknown token also gets { ok: true }. A missing or malformed token gets 401.
 *
 * Self-contained like api/tasks.ts.
 */
import { Redis } from '@upstash/redis';

// Session tokens are 32 random bytes, hex-encoded (api/login.ts).
const TOKEN_RE = /^[a-f0-9]{64}$/;
// Keep in sync with api/login.ts and api/tasks.ts.
const sessionKey = (token: string) => `daysleft:session:${token}`;

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

export const POST = async (request: Request): Promise<Response> => {
  try {
    const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : '';
    if (!TOKEN_RE.test(token)) return json({ error: 'Unauthorized: log in again' }, 401);

    await getRedis().del(sessionKey(token));
    return json({ ok: true });
  } catch (e) {
    // Upstash error messages quote the command, which contains the token: log only the name.
    console.error('[api/logout] internal error', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Internal server error' }, 500);
  }
};
