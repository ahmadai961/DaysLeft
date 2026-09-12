import React, { useEffect } from 'react';
import { Task } from '../types';
import { formatSecondsToFriendly, calculateCompletionTimeSaved } from '../utils/dateUtils';
import { CheckCircle2, Clock, Sparkles, Flame, ArrowRight, Award, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TaskCompletionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  task,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && task) {
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#10b981', '#6366f1', '#f59e0b', '#ec4899'],
        });
      } catch {
        // ignore if confetti fails
      }
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const focusTimeSpent = formatSecondsToFriendly(task.focusSeconds || 0);
  const timeSavedInfo = calculateCompletionTimeSaved(task);

  // Category Color Badges
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Work':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
      case 'Study':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30';
      case 'Health':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
      case 'Finance':
        return 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
      case 'Project':
        return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white border border-zinc-200/90 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col my-auto dark:bg-zinc-900 dark:border-zinc-800/90"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header Wave / Gradient */}
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 sm:p-6 text-white text-center relative overflow-hidden shrink-0">
          {/* Subtle background glow circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-inner mb-3">
            <CheckCircle2 className="w-8 h-8 text-white stroke-[2.5]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Task Completed!
          </h2>
          <p className="text-emerald-50 text-xs sm:text-sm font-medium mt-1">
            Excellent work! Here are your session highlights.
          </p>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1">
          {/* Task Title & Category */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3.5 flex items-start justify-between gap-3 dark:bg-zinc-800 dark:border-zinc-800">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-0.5 dark:text-zinc-500">
                Completed Task
              </span>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 line-clamp-2 dark:text-zinc-50">
                {task.title}
              </h3>
            </div>
            <span
              className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${getCategoryColor(
                task.category
              )}`}
            >
              {task.category}
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Metric 1: Category & Focus Effort */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 flex flex-col justify-between dark:bg-zinc-800 dark:border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1 dark:text-zinc-400">
                <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Focus Effort
                </span>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-mono font-bold text-zinc-900 dark:text-zinc-50">
                  {focusTimeSpent === '0m' ? '< 1m' : focusTimeSpent}
                </span>
                <span className="text-[10px] text-zinc-500 block font-medium mt-0.5 dark:text-zinc-400">
                  Logged in <strong className="text-zinc-700 dark:text-zinc-300">{task.category}</strong>
                </span>
              </div>
            </div>

            {/* Metric 2: Time Saved / Deadline Delta */}
            <div
              className={`border rounded-xl p-3 flex flex-col justify-between ${
                timeSavedInfo.isEarly
                  ? 'bg-cyan-50/70 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30'
                  : 'bg-zinc-50 border-zinc-200/80 dark:bg-zinc-800 dark:border-zinc-800/80'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {timeSavedInfo.isEarly ? (
                  <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                )}
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    timeSavedInfo.isEarly ? 'text-cyan-800 dark:text-cyan-300' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Time Saved
                </span>
              </div>
              <div>
                <div
                  className={`text-lg sm:text-xl font-mono font-bold ${
                    timeSavedInfo.isEarly ? 'text-cyan-700 dark:text-cyan-300' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {timeSavedInfo.isEarly ? timeSavedInfo.formattedSaved : '0m'}
                </div>
                <span
                  className={`text-[10px] block font-medium mt-0.5 ${
                    timeSavedInfo.isEarly ? 'text-cyan-700 dark:text-cyan-300' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {timeSavedInfo.isEarly
                    ? 'Finished before deadline!'
                    : 'Completed past deadline'}
                </span>
              </div>
            </div>
          </div>

          {/* Productivity Tip / Boost Note */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 dark:text-emerald-400" />
            <p className="leading-snug">
              {timeSavedInfo.isEarly
                ? `Great pacing! Your early completion has been deposited into the Time Saved Bank below.`
                : `Focus time has been recorded in your category analytics.`}
            </p>
          </div>

          {/* Action Continue Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Awesome, Keep Going!</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
