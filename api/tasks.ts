/**
 * Vercel serverless function backing the shared task list.
 *
 *   GET    /api/tasks        -> all tasks
 *   PUT    /api/tasks        -> replace the full list (web app save)
 *   POST   /api/tasks        -> add one task (bot)              [Bearer auth]
 *   DELETE /api/tasks/:id    -> remove a task by id/externalId  [Bearer auth]
 *
 * /api/tasks/:id is rewritten to /api/tasks?id=:id in vercel.json.
 * This file is intentionally self-contained (type-only imports from src/) so it
 * bundles cleanly as an ES module on Vercel.
 */
import { Redis } from '@upstash/redis';
import type { Task, TaskPriority, TaskCategory } from '../src/types';

const TASKS_KEY = 'daysleft:tasks';
// Recently deleted ids, so a stale full-list PUT from the web app cannot resurrect them.
const DELETED_KEY = 'daysleft:deleted';
const MAX_TOMBSTONES = 1000;

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

async function readTasks(): Promise<Task[]> {
  const stored = await getRedis().get<Task[]>(TASKS_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function writeTasks(tasks: Task[]): Promise<void> {
  await getRedis().set(TASKS_KEY, tasks);
}

async function readTombstones(): Promise<string[]> {
  const stored = await getRedis().get<string[]>(DELETED_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function addTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = await readTombstones();
  const merged = [...existing.filter((id) => !ids.includes(id)), ...ids].slice(-MAX_TOMBSTONES);
  await getRedis().set(DELETED_KEY, merged);
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.DAYSLEFT_API_KEY;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return !!match && match[1].trim() === expected;
}

function unauthorized(): Response {
  return json({ error: 'Unauthorized: missing or invalid "Authorization: Bearer <DAYSLEFT_API_KEY>" header' }, 401);
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
      console.error('[api/tasks]', e);
      return json({ error: 'Internal server error', message: e instanceof Error ? e.message : String(e) }, 500);
    }
  };
}

export const GET = withErrorHandling(async () => {
  return json({ tasks: await readTasks() });
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

  const [current, tombstones] = await Promise.all([readTasks(), readTombstones()]);
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
    await addTombstones(removedByClient);
  }

  await writeTasks(next);
  return json({ tasks: next });
});

export const POST = withErrorHandling(async (request) => {
  if (!isAuthorized(request)) return unauthorized();

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
  if (errors.length) return badRequest('Invalid task', errors);

  const tasks = await readTasks();
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

  await writeTasks([task, ...tasks]);
  return json({ task }, 201);
});

export const DELETE = withErrorHandling(async (request) => {
  if (!isAuthorized(request)) return unauthorized();

  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return badRequest('Task id is required: DELETE /api/tasks/:id');

  const tasks = await readTasks();
  // Accept either the DaysLeft id or the externalId supplied at creation.
  const removed = tasks.filter((t) => t.id === id || (t.externalId !== undefined && t.externalId === id));
  if (removed.length === 0) return json({ error: `Task "${id}" not found` }, 404);

  const removedIds = new Set(removed.map((t) => t.id));
  await writeTasks(tasks.filter((t) => !removedIds.has(t.id)));
  await addTombstones([...removedIds]);
  return json({ deleted: removed });
});
