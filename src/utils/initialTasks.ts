import { Task } from '../types';

/** Legacy per-device cache. No longer used: it could leak one board's tasks into another. */
export const STORAGE_KEY = 'daysleft_tasks';

/**
 * Returns the base state: an empty list ([])
 */
export function getInitialTasks(): Task[] {
  return [];
}

/** Removes the legacy 'daysleft_tasks' cache so an old board can never be uploaded anywhere. */
export function clearLegacyTaskCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage inaccessible (private browsing, etc.) - nothing to clear
  }
}
