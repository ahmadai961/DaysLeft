import { Task } from '../types';

export const STORAGE_KEY = 'daysleft_tasks';

/**
 * Returns the base state: an empty list ([])
 */
export function getInitialTasks(): Task[] {
  return [];
}

/**
 * Loads tasks from browser localStorage under 'daysleft_tasks'.
 * If saved data exists on this device, returns it; otherwise returns an empty list ([]).
 */
export function loadTasksFromStorage(): Task[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tasks from localStorage:', e);
  }
  return [];
}

/**
 * Persists tasks to browser localStorage under 'daysleft_tasks'.
 */
export function saveTasksToStorage(tasks: Task[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage:', e);
  }
}

