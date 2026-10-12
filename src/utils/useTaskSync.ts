import { useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Task } from '../types';

const API_URL = '/api/tasks';
const POLL_INTERVAL_MS = 10_000;
const SAVE_DEBOUNCE_MS = 1_000;
const SAVE_MAX_WAIT_MS = 5_000;

/** Thrown on 401: the session expired or is invalid, so the user must log in again. */
export class SessionExpiredError extends Error {}

async function fetchServerTasks(token: string): Promise<Task[]> {
  const res = await fetch(API_URL, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error(`GET ${API_URL} failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.tasks)) throw new Error(`GET ${API_URL} returned an unexpected payload`);
  return data.tasks;
}

/** Ends this session on the server (deletes only this token). Failures are ignored. */
async function endServerSession(token: string): Promise<void> {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    });
  } catch {
    // Offline etc.: the session still expires on its own (12h TTL).
  }
}

async function putServerTasks(token: string, tasks: Task[], knownIds: string[], keepalive = false): Promise<Task[]> {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tasks, knownIds }),
    keepalive,
  });
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error(`PUT ${API_URL} failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.tasks)) throw new Error(`PUT ${API_URL} returned an unexpected payload`);
  return data.tasks;
}

/**
 * Merges a fresh server list into the local list.
 * - Local tasks with unsaved changes, or listed in protectedIds (being edited / in focus), win.
 * - Server tasks the client has never seen (e.g. added by the bot) are added.
 * - Known server tasks missing locally are pending local deletes and stay removed.
 * - Local tasks the server no longer has were deleted remotely and are dropped,
 *   unless they are brand new locally or protected.
 */
function mergeServerTasks(
  local: Task[],
  server: Task[],
  synced: Map<string, string>,
  protectedIds: Set<string>
): Task[] {
  const localById = new Map(local.map((t) => [t.id, t]));
  const serverIds = new Set(server.map((t) => t.id));
  const isLocallyChanged = (t: Task) => synced.get(t.id) !== JSON.stringify(t);

  const localOnly = local.filter(
    (t) => !serverIds.has(t.id) && (!synced.has(t.id) || protectedIds.has(t.id))
  );
  const merged: Task[] = [];
  for (const s of server) {
    const l = localById.get(s.id);
    if (!l) {
      if (!synced.has(s.id)) merged.push(s);
      continue;
    }
    merged.push(isLocallyChanged(l) || protectedIds.has(s.id) ? l : s);
  }
  return [...localOnly, ...merged];
}

/**
 * Keeps the task list in sync with the signed-in user's board on /api/tasks.
 * The session token is fixed for the lifetime of the calling component (it is
 * keyed by the token), so nothing here can mix two boards. There is no local
 * cache: the server is the only source of tasks.
 *
 * Returns lock(): saves the last unsaved edit, then ends the session on the server.
 */
export function useTaskSync(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  protectedIds: string[],
  token: string,
  onSessionExpired: () => void
) {
  const onExpiredRef = useRef(onSessionExpired);
  onExpiredRef.current = onSessionExpired;
  // False once unmounted (locked / logged out): late responses are then ignored.
  const activeRef = useRef(true);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const protectedRef = useRef(new Set(protectedIds));
  protectedRef.current = new Set(protectedIds);

  // Last known server version of each task (id -> JSON), used to detect local changes.
  const syncedRef = useRef<Map<string, string> | null>(null);
  const inFlightRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPendingAtRef = useRef<number | null>(null);

  const isDirty = (list: Task[]) => {
    const synced = syncedRef.current;
    if (!synced) return false;
    if (list.length !== synced.size) return true;
    return list.some((t) => synced.get(t.id) !== JSON.stringify(t));
  };

  const handleError = (e: unknown, message: string) => {
    if (!activeRef.current) return;
    if (e instanceof SessionExpiredError) {
      activeRef.current = false;
      onExpiredRef.current();
      return;
    }
    console.warn(message, e);
  };

  const applyServerTasks = (server: Task[]) => {
    if (!activeRef.current) return;
    const prevSynced = syncedRef.current ?? new Map<string, string>();
    const merged = mergeServerTasks(tasksRef.current, server, prevSynced, protectedRef.current);
    syncedRef.current = new Map(server.map((t) => [t.id, JSON.stringify(t)]));
    tasksRef.current = merged;
    setTasks(merged);
  };

  const flushSave = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!activeRef.current || inFlightRef.current || !syncedRef.current) return;
    const snapshot = tasksRef.current;
    if (!isDirty(snapshot)) {
      firstPendingAtRef.current = null;
      return;
    }
    inFlightRef.current = true;
    try {
      const server = await putServerTasks(token, snapshot, [...syncedRef.current.keys()]);
      firstPendingAtRef.current = null;
      applyServerTasks(server);
    } catch (e) {
      handleError(e, 'Failed to save tasks to server; will retry.');
    } finally {
      inFlightRef.current = false;
    }
    // Changes made while the request was in flight get saved next.
    if (activeRef.current && isDirty(tasksRef.current)) scheduleSave();
  };

  const scheduleSave = () => {
    const now = Date.now();
    if (firstPendingAtRef.current === null) firstPendingAtRef.current = now;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const waited = now - firstPendingAtRef.current;
    const delay = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS - waited));
    saveTimerRef.current = setTimeout(() => void flushSave(), delay);
  };

  const initialLoad = async () => {
    if (!activeRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const server = await fetchServerTasks(token);
      if (!activeRef.current) return;
      syncedRef.current = new Map(server.map((t) => [t.id, JSON.stringify(t)]));
      tasksRef.current = server;
      setTasks(server);
    } catch (e) {
      handleError(e, 'Could not load tasks from server; will retry.');
    } finally {
      inFlightRef.current = false;
    }
  };

  const refresh = async () => {
    if (!activeRef.current) return;
    if (!syncedRef.current) return initialLoad();
    if (inFlightRef.current) return;
    // Unsaved local changes: saving returns the latest server list too.
    if (isDirty(tasksRef.current)) return flushSave();
    inFlightRef.current = true;
    try {
      const server = await fetchServerTasks(token);
      applyServerTasks(server);
    } catch (e) {
      handleError(e, 'Failed to refresh tasks from server.');
    } finally {
      inFlightRef.current = false;
    }
  };

  // Sends unsaved edits once more with this session's own token (same board).
  const sendFinalSave = (): Promise<unknown> => {
    const synced = syncedRef.current;
    if (!activeRef.current || !synced || !isDirty(tasksRef.current)) return Promise.resolve();
    return putServerTasks(token, tasksRef.current, [...synced.keys()], true).catch(() => {});
  };

  // Lock button: stop syncing, save the last edit, and only then delete the session,
  // so the final save is not rejected with 401.
  const lock = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const saved = sendFinalSave();
    activeRef.current = false; // the unmount cleanup below must not save a second time
    void saved.then(() => endServerSession(token));
  };

  // Push to the server (debounced) when something changed. Nothing is cached locally.
  useEffect(() => {
    if (activeRef.current && syncedRef.current && isDirty(tasks)) scheduleSave();
  }, [tasks]);

  // Initial load + polling + refresh when the tab regains focus. Runs only while
  // signed in (the component is unmounted on lock/logout, which stops everything).
  useEffect(() => {
    activeRef.current = true;
    void initialLoad();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      // On unmount, send unsaved edits once more (a no-op after lock(), which already did).
      void sendFinalSave();
      activeRef.current = false;
    };
  }, []);

  return lock;
}
