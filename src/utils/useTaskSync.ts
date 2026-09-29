import { useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Task } from '../types';
import { saveTasksToStorage } from './initialTasks';

const API_URL = '/api/tasks';
const POLL_INTERVAL_MS = 10_000;
const SAVE_DEBOUNCE_MS = 1_000;
const SAVE_MAX_WAIT_MS = 5_000;

async function fetchServerTasks(): Promise<Task[]> {
  const res = await fetch(API_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${API_URL} failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.tasks)) throw new Error(`GET ${API_URL} returned an unexpected payload`);
  return data.tasks;
}

async function putServerTasks(tasks: Task[], knownIds: string[]): Promise<Task[]> {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, knownIds }),
  });
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
 * Keeps the task list in sync with the /api/tasks backend.
 * localStorage is always written as an offline cache/fallback.
 */
export function useTaskSync(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  protectedIds: string[]
) {
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

  const applyServerTasks = (server: Task[]) => {
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
    if (inFlightRef.current || !syncedRef.current) return;
    const snapshot = tasksRef.current;
    if (!isDirty(snapshot)) {
      firstPendingAtRef.current = null;
      return;
    }
    inFlightRef.current = true;
    try {
      const server = await putServerTasks(snapshot, [...syncedRef.current.keys()]);
      firstPendingAtRef.current = null;
      applyServerTasks(server);
    } catch (e) {
      console.warn('Failed to save tasks to server; kept in localStorage.', e);
    } finally {
      inFlightRef.current = false;
    }
    // Changes made while the request was in flight get saved next.
    if (isDirty(tasksRef.current)) scheduleSave();
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
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const server = await fetchServerTasks();
      const local = tasksRef.current;
      if (server.length === 0 && local.length > 0) {
        // First run against an empty backend: upload this device's tasks so nothing is lost.
        const uploaded = await putServerTasks(local, []);
        syncedRef.current = new Map();
        applyServerTasks(uploaded);
      } else {
        syncedRef.current = new Map(server.map((t) => [t.id, JSON.stringify(t)]));
        tasksRef.current = server;
        setTasks(server);
      }
    } catch (e) {
      console.warn('Could not load tasks from server; using localStorage.', e);
    } finally {
      inFlightRef.current = false;
    }
  };

  const refresh = async () => {
    if (!syncedRef.current) return initialLoad();
    if (inFlightRef.current) return;
    // Unsaved local changes: saving returns the latest server list too.
    if (isDirty(tasksRef.current)) return flushSave();
    inFlightRef.current = true;
    try {
      const server = await fetchServerTasks();
      applyServerTasks(server);
    } catch (e) {
      console.warn('Failed to refresh tasks from server.', e);
    } finally {
      inFlightRef.current = false;
    }
  };

  // Always cache locally; push to the server (debounced) when something changed.
  useEffect(() => {
    saveTasksToStorage(tasks);
    if (syncedRef.current && isDirty(tasks)) scheduleSave();
  }, [tasks]);

  // Initial load + polling + refresh when the tab regains focus.
  useEffect(() => {
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
    };
  }, []);
}
