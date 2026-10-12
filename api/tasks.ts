/**
 * Vercel serverless function backing the per-manager task boards.
 *
 *   GET    /api/tasks              -> the board's tasks          [session token, or API key + ?board=]
 *   PUT    /api/tasks              -> replace the full list      [session token]
 *   POST   /api/tasks              -> add one task (bot)         [API key; body.board]
 *   DELETE /api/tasks/:id?board=   -> remove by id/externalId    [API key]
 *
 * Auth is "Authorization: Bearer <value>": either DAYSLEFT_API_KEY (Hermes) or a
 * session token from POST /api/login, which the server maps to exactly one board.
 * With the API key, a missing board means "test", so nothing reaches a manager's
 * board by accident.
 *
 * /api/tasks/:id is rewritten to /api/tasks?id=:id in vercel.json.
 * This file is intentionally self-contained (type-only imports from src/) so it
 * bundles cleanly as an ES module on Vercel.
 */
import { Redis } from '@upstash/redis';
import { timingSafeEqual, createHash } from 'node:crypto';
import type { Task, TaskPriority, TaskCategory } from '../src/types';

// Per-board keys, under their own "board:" prefix so no board name can collide with the
// login keys (daysleft:pin:*, daysleft:session:*, daysleft:sessionver:*, daysleft:loginfail:*).
// The legacy shared keys (daysleft:tasks / daysleft:deleted) are never touched.
const tasksKey = (board: string) => `daysleft:board:${board}:tasks`;
// Recently deleted ids, so a stale full-list PUT from the web app cannot resurrect them.
const deletedKey = (board: string) => `daysleft:board:${board}:deleted`;
const sessionKey = (token: string) => `daysleft:session:${token}`;
// Bumped by PUT /api/pin; sessions created under an older version are dead (api/login.ts).
const sessionVersionKey = (username: string) => `daysleft:sessionver:${username}`;
const MAX_TOMBSTONES = 1000;
const DEFAULT_API_BOARD = 'test';
// Same rule as usernames in api/login.ts and api/pin.ts.
const BOARD_RE = /^[a-z0-9_-]{1,32}$/;
// Session tokens are 32 random bytes, hex-encoded (api/login.ts).
const TOKEN_RE = /^[a-f0-9]{64}$/;

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES: TaskCategory[] = ['Work', 'Personal', 'Study', 'Health', 'Finance', 'Project', 'Other'];
// Same palette as PRESET_TASK_COLORS in src/utils/dateUtils.ts
const COLORS = [
  '#0284c7', '#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e',
  '#0d9488', '#a855f7', '#06b6d4', '#ea580c', '#ec4899', '#65a30d',
];

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

function badRequest(error: string, details?: string[]): Response {
  return json(details && details.length ? { error, details } : { error }, 400);
}

async function readTasks(board: string): Promise<Task[]> {
  const stored = await getRedis().get<Task[]>(tasksKey(board));
  return Array.isArray(stored) ? stored : [];
}

async function writeTasks(board: string, tasks: Task[]): Promise<void> {
  await getRedis().set(tasksKey(board), tasks);
}

async function readTombstones(board: string): Promise<string[]> {
  const stored = await getRedis().get<string[]>(deletedKey(board));
  return Array.isArray(stored) ? stored : [];
}

async function addTombstones(board: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = await readTombstones(board);
  const merged = [...existing.filter((id) => !ids.includes(id)), ...ids].slice(-MAX_TOMBSTONES);
  await getRedis().set(deletedKey(board), merged);
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Compares fixed-length digests so neither the key's content nor its length leaks through timing.
function isApiKey(value: string | null): boolean {
  const expected = process.env.DAYSLEFT_API_KEY;
  if (!expected || !value) return false;
  const a = createHash('sha256').update(value).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Reads a numeric counter that Upstash may return as a number or a string; missing = 0. */
function toVersion(value: unknown): number | null {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
}

/**
 * Board for a browser session token, or null if the token is unknown, expired, or
 * was created before the user's PIN was last set (session value is "username:version").
 */
async function boardForSession(token: string | null): Promise<string | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  let session: unknown;
  try {
    session = await getRedis().get(sessionKey(token));
  } catch {
    // Upstash errors quote the command (and so the token); don't let it reach logs or responses.
    throw new Error('Session lookup failed');
  }
  if (typeof session !== 'string') return null;
  const match = session.match(/^([a-z0-9_-]{1,32}):(\d+)$/);
  if (!match || !BOARD_RE.test(match[1])) return null;
  const username = match[1];
  const current = toVersion(await getRedis().get(sessionVersionKey(username)));
  return current !== null && current === Number(match[2]) ? username : null;
}

/** Board named by Hermes, defaulting to "test"; null if the name is invalid. */
function apiBoard(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return DEFAULT_API_BOARD;
  return typeof value === 'string' && BOARD_RE.test(value) ? value : null;
}

function unauthorized(): Response {
  return json({ error: 'Unauthorized: missing or invalid "Authorization: Bearer <DAYSLEFT_API_KEY>" header' }, 401);
}

function sessionRequired(): Response {
  return json({ error: 'Unauthorized: log in again' }, 401);
}

function invalidBoard(): Response {
  return badRequest('"board" must be 1-32 characters of lowercase a-z, 0-9, "_" or "-"');
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    const text = await request.text();
    if (!text.trim()) return { ok: false, response: badRequest('Request body is empty; expected JSON') };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: badRequest('Request body is not valid JSON') };
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isTaskShape(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' && t.id.length > 0 &&
    typeof t.title === 'string' &&
    typeof t.date === 'string' &&
    typeof t.time === 'string' &&
    typeof t.completed === 'boolean'
  );
}

function withErrorHandling(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (e) {
      // Upstash error messages quote the command (keys, values): log only the error name.
      console.error('[api/tasks] internal error', e instanceof Error ? e.name : 'unknown');
      return json({ error: 'Internal server error' }, 500);
    }
  };
}

export const GET = withErrorHandling(async (request) => {
  const token = bearer(request);
  let board: string | null;
  if (isApiKey(token)) {
    board = apiBoard(new URL(request.url).searchParams.get('board'));
    if (!board) return invalidBoard();
  } else {
    board = await boardForSession(token);
    if (!board) return sessionRequired();
  }
  return json({ tasks: await readTasks(board) });
});

/**
 * Body: Task[]  or  { tasks: Task[], knownIds?: string[] }
 *
 * knownIds lists every task id the client has already seen from the server.
 * Server tasks that are neither in `tasks` nor in `knownIds` were created
 * elsewhere (e.g. by the bot) after the client last synced, so they are kept
 * instead of being wiped. Ids that were deleted via DELETE are never re-added.
 */
export const PUT = withErrorHandling(async (request) => {
  // Full-list replace is browser-only: the board always comes from the session.
  const board = await boardForSession(bearer(request));
  if (!board) return sessionRequired();

  const body = await readJsonBody(request);
  if ('response' in body) return body.response;

  const raw = body.value as unknown;
  const incoming = Array.isArray(raw) ? raw : (raw as { tasks?: unknown })?.tasks;
  if (!Array.isArray(incoming)) {
    return badRequest('Body must be a JSON array of tasks or an object { "tasks": [...] }');
  }
  const invalid = incoming
    .map((t, i) => (isTaskShape(t) ? null : `tasks[${i}] is missing id/title/date/time/completed`))
    .filter((x): x is string => x !== null);
  if (invalid.length) return badRequest('Invalid task list', invalid.slice(0, 10));

  const knownIdsRaw = Array.isArray(raw) ? undefined : (raw as { knownIds?: unknown }).knownIds;
  if (knownIdsRaw !== undefined && (!Array.isArray(knownIdsRaw) || knownIdsRaw.some((x) => typeof x !== 'string'))) {
    return badRequest('"knownIds" must be an array of strings');
  }

  const [current, tombstones] = await Promise.all([readTasks(board), readTombstones(board)]);
  const deleted = new Set(tombstones);
  const clientTasks = (incoming as Task[]).filter((t) => !deleted.has(t.id));
  const clientIds = new Set(clientTasks.map((t) => t.id));

  let next = clientTasks;
  if (knownIdsRaw !== undefined) {
    const known = new Set(knownIdsRaw as string[]);
    const unseenServerTasks = current.filter((t) => !clientIds.has(t.id) && !known.has(t.id));
    next = [...unseenServerTasks, ...clientTasks];
    // Tasks the client knew about and dropped were deleted in the app: tombstone them too.
    const removedByClient = current.filter((t) => !clientIds.has(t.id) && known.has(t.id)).map((t) => t.id);
    await addTombstones(board, removedByClient);
  }

  await writeTasks(board, next);
  return json({ tasks: next });
});

export const POST = withErrorHandling(async (request) => {
  if (!isApiKey(bearer(request))) return unauthorized();

  const body = await readJsonBody(request);
  if ('response' in body) return body.response;
  const input = body.value;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return badRequest('Body must be a JSON object');
  }
  const b = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.title !== 'string' || !b.title.trim()) errors.push('"title" is required and must be a non-empty string');
  if (b.description !== undefined && typeof b.description !== 'string') errors.push('"description" must be a string');
  if (typeof b.date !== 'string' || !isValidDate(b.date)) errors.push('"date" is required and must be a valid date in YYYY-MM-DD format');
  if (b.time !== undefined && b.time !== null && b.time !== '' && (typeof b.time !== 'string' || !isValidTime(b.time))) {
    errors.push('"time" must be in HH:mm (24h) format, or omitted/empty for an all-day task');
  }
  if (b.priority !== undefined && !PRIORITIES.includes(b.priority as TaskPriority)) {
    errors.push(`"priority" must be one of: ${PRIORITIES.join(', ')}`);
  }
  if (b.category !== undefined && !CATEGORIES.includes(b.category as TaskCategory)) {
    errors.push(`"category" must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (b.externalId !== undefined && (typeof b.externalId !== 'string' || !b.externalId.trim())) {
    errors.push('"externalId" must be a non-empty string');
  }
  const board = apiBoard(b.board);
  if (!board) errors.push('"board" must be 1-32 characters of lowercase a-z, 0-9, "_" or "-"');
  if (errors.length || !board) return badRequest('Invalid task', errors);

  const tasks = await readTasks(board);
  const externalId = typeof b.externalId === 'string' ? b.externalId.trim() : undefined;

  // Idempotency: re-posting the same externalId returns the existing task.
  if (externalId) {
    const existing = tasks.find((t) => t.externalId === externalId);
    if (existing) return json({ task: existing, duplicate: true }, 200);
  }

  const time = typeof b.time === 'string' ? b.time : '';
  // Mirrors the defaults of TaskModal + handleSaveTask in src/App.tsx
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: (b.title as string).trim(),
    description: typeof b.description === 'string' ? b.description.trim() : '',
    date: b.date as string,
    time,
    isAllDay: time === '',
    priority: (b.priority as TaskPriority) ?? 'medium',
    category: (b.category as TaskCategory) ?? 'Work',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    completed: false,
    pinnedCountdown: false,
    checklist: [],
    createdAt: new Date().toISOString(),
    focusSeconds: 0,
    isFocusRunning: false,
    ...(externalId ? { externalId } : {}),
  };

  await writeTasks(board, [task, ...tasks]);
  return json({ task }, 201);
});

export const DELETE = withErrorHandling(async (request) => {
  if (!isApiKey(bearer(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const board = apiBoard(params.get('board'));
  if (!board) return invalidBoard();
  const id = params.get('id')?.trim();
  if (!id) return badRequest('Task id is required: DELETE /api/tasks/:id');

  const tasks = await readTasks(board);
  // Accept either the DaysLeft id or the externalId supplied at creation.
  const removed = tasks.filter((t) => t.id === id || (t.externalId !== undefined && t.externalId === id));
  if (removed.length === 0) return json({ error: `Task "${id}" not found` }, 404);

  const removedIds = new Set(removed.map((t) => t.id));
  await writeTasks(board, tasks.filter((t) => !removedIds.has(t.id)));
  await addTombstones(board, [...removedIds]);
  return json({ deleted: removed });
});
