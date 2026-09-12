export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Resolve the theme to use on first render: the user's previously saved
 * choice if there is one, otherwise the OS-level color-scheme preference.
 */
export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage inaccessible (private browsing, etc.) - fall through
  }

  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // matchMedia unavailable
  }

  return 'light';
}

/** Reflect the theme onto <html> (for Tailwind's `dark:` variant) and persist it. */
export function applyTheme(theme: Theme): void {
  try {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {
    // no-op in non-browser environments
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}
