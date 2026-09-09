import React, { useState } from 'react';
import { Task, TaskCategory, TaskPriority } from '../types';
import {
  Sparkles,
  X,
  Calendar as CalendarIcon,
  Clock,
  Check,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Tag,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface GeneratedScheduleEvent {
  title: string;
  targetDate: string; // ISO 8601 string, e.g. "2026-10-15T18:00:00"
  durationMinutes: number;
  category: string;
  description?: string;
  priority?: string;
}

interface AutoSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptSchedule: (newTasks: Task[]) => void;
}

const SUGGESTED_CHIPS = [
  'Prep for exam next week with 3 study sessions',
  'Daily workout schedule for the next 5 days',
  'Launch project sprint with 3 milestone countdowns',
  'Review personal finances by Friday evening',
  '7-day morning mindfulness & reading routine',
];

// Helper to normalize category
function normalizeCategory(cat: string): TaskCategory {
  const c = cat.toLowerCase();
  if (c.includes('study') || c.includes('exam') || c.includes('learn') || c.includes('read')) {
    return 'Study';
  }
  if (
    c.includes('health') ||
    c.includes('workout') ||
    c.includes('fitness') ||
    c.includes('gym') ||
    c.includes('run')
  ) {
    return 'Health';
  }
  if (c.includes('project') || c.includes('code') || c.includes('dev') || c.includes('sprint')) {
    return 'Project';
  }
  if (c.includes('work') || c.includes('client') || c.includes('job') || c.includes('meeting')) {
    return 'Work';
  }
  if (c.includes('finance') || c.includes('budget') || c.includes('tax') || c.includes('money')) {
    return 'Finance';
  }
  if (c.includes('personal') || c.includes('habit') || c.includes('home')) {
    return 'Personal';
  }
  return 'Other';
}

// Helper to normalize priority
function normalizePriority(pri?: string): TaskPriority {
  const p = pri?.toLowerCase() || '';
  if (p === 'urgent') return 'urgent';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

// Helper to format ISO date-time into readable string
function formatTargetDateTime(targetDateStr: string): {
  dateFormatted: string;
  timeFormatted: string;
  relativeCountdown: string;
} {
  try {
    const d = new Date(targetDateStr);
    if (isNaN(d.getTime())) {
      return {
        dateFormatted: targetDateStr,
        timeFormatted: '',
        relativeCountdown: '',
      };
    }

    const dateFormatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Relative countdown calculation
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    let relativeCountdown = '';

    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) {
        relativeCountdown = `in ${diffDays}d ${diffHours % 24}h`;
      } else if (diffHours > 0) {
        relativeCountdown = `in ${diffHours}h`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        relativeCountdown = `in ${Math.max(1, diffMins)}m`;
      }
    } else {
      relativeCountdown = 'Due today';
    }

    return { dateFormatted, timeFormatted, relativeCountdown };
  } catch {
    return {
      dateFormatted: targetDateStr,
      timeFormatted: '',
      relativeCountdown: '',
    };
  }
}

export const AutoSchedulerModal: React.FC<AutoSchedulerModalProps> = ({
  isOpen,
  onClose,
  onAcceptSchedule,
}) => {
  const [goalPrompt, setGoalPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedEvents, setGeneratedEvents] = useState<GeneratedScheduleEvent[]>([]);
  const [selectedEventIndices, setSelectedEventIndices] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!goalPrompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setGeneratedEvents([]);

    try {
      const response = await fetch('/api/auto-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: goalPrompt.trim(),
          todayDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const events: GeneratedScheduleEvent[] = data.events || [];

      if (!Array.isArray(events) || events.length === 0) {
        throw new Error('No sessions could be formulated. Please try rephrasing your goal.');
      }

      setGeneratedEvents(events);
      // Default to selecting all generated events
      setSelectedEventIndices(new Set(events.map((_, i) => i)));
    } catch (err: any) {
      console.error('Error generating auto-schedule:', err);
      setError(
        err?.message || 'Failed to connect to the scheduling agent. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (chip: string) => {
    setGoalPrompt(chip);
  };

  const handleToggleEventSelect = (index: number) => {
    setSelectedEventIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAccept = () => {
    const selectedEvents = generatedEvents.filter((_, idx) =>
      selectedEventIndices.has(idx)
    );

    if (selectedEvents.length === 0) return;

    // Convert GeneratedScheduleEvent to Task objects
    const nowIso = new Date().toISOString();
    const createdTasks: Task[] = selectedEvents.map((evt, idx) => {
      let datePart = '';
      let timePart = '18:00';

      if (evt.targetDate.includes('T')) {
        const parts = evt.targetDate.split('T');
        datePart = parts[0];
        timePart = parts[1].substring(0, 5);
      } else {
        datePart = evt.targetDate;
      }

      // If datePart is somehow empty, fall back to today + 1 day
      if (!datePart || !datePart.includes('-')) {
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + idx + 1);
        datePart = fallbackDate.toISOString().split('T')[0];
      }

      const category = normalizeCategory(evt.category);
      const priority = normalizePriority(evt.priority);
      const duration = evt.durationMinutes || 60;

      const subtask1Time = Math.max(5, Math.round(duration * 0.15));
      const subtask2Time = Math.max(15, Math.round(duration * 0.7));
      const subtask3Time = Math.max(5, Math.round(duration * 0.15));

      return {
        id: `task-ai-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: evt.title,
        description:
          evt.description ||
          `AI scheduled session: ${duration} minutes planned for ${evt.title}.`,
        date: datePart,
        time: timePart,
        isAllDay: false,
        priority,
        category,
        completed: false,
        createdAt: nowIso,
        pinnedCountdown: idx === 0, // Pin the earliest countdown session
        focusSeconds: 0,
        isFocusRunning: false,
        checklist: [
          {
            id: `chk-${Date.now()}-${idx}-1`,
            text: `Setup workspace & clarify key concepts (~${subtask1Time}m)`,
            done: false,
          },
          {
            id: `chk-${Date.now()}-${idx}-2`,
            text: `Focused execution block & problem sets (~${subtask2Time}m)`,
            done: false,
          },
          {
            id: `chk-${Date.now()}-${idx}-3`,
            text: `Review progress, log findings & summarize (~${subtask3Time}m)`,
            done: false,
          },
        ],
      };
    });

    onAcceptSchedule(createdTasks);

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#34d399', '#f59e0b'],
      });
    } catch {
      // Ignored if confetti fails in iframe
    }

    onClose();
  };

  const handleReset = () => {
    setGeneratedEvents([]);
    setSelectedEventIndices(new Set());
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-zinc-200/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-900"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  AI Auto-Scheduler
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  Gemini Agent
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Decompose any goal or exam into scheduled countdown sessions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* STEP 1: Prompt Input & Suggested Chips (if not previewing) */}
          {generatedEvents.length === 0 ? (
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  What is your upcoming goal or target?
                </label>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={goalPrompt}
                    onChange={(e) => setGoalPrompt(e.target.value)}
                    placeholder="e.g., I have an exam on Oct 20, break down a study schedule for me with 3 study sessions..."
                    className="w-full bg-zinc-50 focus:bg-white text-zinc-900 placeholder-zinc-400 border border-zinc-300 focus:border-zinc-900 rounded-xl p-3.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all leading-relaxed resize-none shadow-2xs"
                    disabled={isLoading}
                    autoFocus
                  />
                  {goalPrompt && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setGoalPrompt('')}
                      className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 text-xs font-bold p-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Suggested Chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Suggested Prompts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_CHIPS.map((chip, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        disabled={isLoading}
                        className="text-[11px] text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer text-left active:scale-98"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <div>
                      <p className="font-semibold">Scheduling Agent Notice</p>
                      <p className="text-[11px] text-rose-600">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!goalPrompt.trim() || isLoading}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                      !goalPrompt.trim() || isLoading
                        ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Formulating Schedule...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                        <span>Generate Schedule</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Informative Helper Callout */}
              <div className="p-3.5 bg-sky-50/70 border border-sky-100 rounded-xl text-sky-950 flex items-start gap-2.5">
                <CalendarIcon className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-sky-800">
                  <strong className="font-semibold text-sky-900">How it works: </strong>
                  The agent reviews today's date, computes the required pacing, and generates
                  concrete countdown sessions with target dates, durations, and deep-work
                  milestones ready to append to your calendar.
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview Generated Sessions */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Preview Header Banner */}
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/90 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                      The AI generated {generatedEvents.length} countdown sessions:
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      {selectedEventIndices.size} of {generatedEvents.length} selected to add
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold flex items-center gap-1 p-1 rounded hover:bg-zinc-100 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Try another</span>
                </button>
              </div>

              {/* Event Cards List */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {generatedEvents.map((evt, idx) => {
                  const isSelected = selectedEventIndices.has(idx);
                  const { dateFormatted, timeFormatted, relativeCountdown } =
                    formatTargetDateTime(evt.targetDate);
                  const category = normalizeCategory(evt.category);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleEventSelect(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isSelected
                          ? 'bg-white border-zinc-900/40 shadow-xs'
                          : 'bg-zinc-50/80 border-zinc-200 text-zinc-400 opacity-60'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white'
                            : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isSelected ? 'text-zinc-900' : 'text-zinc-500'
                            }`}
                          >
                            {evt.title}
                          </h4>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Category Pill */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {category}
                            </span>

                            {/* Duration Badge */}
                            <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-0.5 font-mono">
                              <Clock className="w-2.5 h-2.5" />
                              {evt.durationMinutes}m
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        {evt.description && (
                          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                            {evt.description}
                          </p>
                        )}

                        {/* Date & Countdown Info */}
                        <div className="pt-1 flex items-center gap-2 text-[11px] text-zinc-600 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-zinc-800">
                            <CalendarIcon className="w-3 h-3 text-zinc-400" />
                            {dateFormatted} {timeFormatted && `• ${timeFormatted}`}
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 text-[10px]">
                            ⏳ {relativeCountdown}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: [Accept] [Cancel] */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={selectedEventIndices.size === 0}
                    className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      selectedEventIndices.size === 0
                        ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Accept {selectedEventIndices.size > 0 ? `(${selectedEventIndices.size})` : ''} & Add to Calendar
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
