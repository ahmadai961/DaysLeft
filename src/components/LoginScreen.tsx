import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Lock } from 'lucide-react';
import { applyTheme, getInitialTheme } from '../utils/theme';

export interface Session {
  token: string;
  username: string;
}

interface LoginScreenProps {
  onLogin: (session: Session) => void;
}

/** Username + PIN sign-in. The returned token is only handed to the parent's state. */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The board (which normally applies the theme) isn't mounted yet.
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.token === 'string' && typeof data?.username === 'string') {
        setPin('');
        onLogin({ token: data.token, username: data.username });
        return;
      }
      setError(
        res.status === 401
          ? 'Invalid username or PIN'
          : res.status === 429
            ? 'Too many attempts. Please try again in a few minutes.'
            : 'Could not sign in. Please try again.'
      );
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPin('');
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-zinc-50 focus:bg-white text-sm text-zinc-800 placeholder-zinc-400 border border-zinc-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all dark:bg-zinc-800 dark:focus:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:focus:ring-blue-500/40 dark:focus:border-blue-500';

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex items-center justify-center px-4 font-['Plus_Jakarta_Sans',sans-serif] dark:bg-zinc-900 dark:text-zinc-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl shadow-xs p-6 space-y-5 dark:bg-zinc-800/60 dark:border-zinc-800"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight leading-tight">Calendar & Countdown</h1>
            <span className="text-[11px] text-zinc-500 font-medium block dark:text-zinc-400">
              Sign in to your board
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">PIN</span>
            <input
              type="password"
              name="pin"
              autoComplete="current-password"
              inputMode="numeric"
              pattern="\d{4,6}"
              title="4 to 6 digits"
              required
              minLength={4}
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} tracking-[0.3em]`}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer active:scale-95"
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span>{isSubmitting ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>
    </div>
  );
};
