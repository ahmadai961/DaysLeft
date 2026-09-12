import React, { useState, useEffect } from 'react';
import { Task, CountdownState } from '../types';
import {
  calculateTaskCountdown,
  formatFriendlyDate,
  formatTime,
  formatSecondsToHMS,
  formatSecondsToFriendly,
  getTaskColor,
} from '../utils/dateUtils';
import {
  Clock,
  Calendar,
  Check,
  Edit3,
  Pin,
  Trash2,
  Maximize2,
  Flame,
  Play,
  Pause,
  Square,
  Zap,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CountdownCardProps {
  task: Task;
  allTasks?: Task[];
  onSelectTask?: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onTogglePinCountdown?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleChecklistItem?: (taskId: string, itemId: string) => void;
  onOpenZenMode?: (task: Task) => void;
  onToggleFocus?: (taskId: string) => void;
  onStopAndLogFocus?: (taskId: string) => void;
  onRestartFocus?: (taskId: string) => void;
  showSwitcher?: boolean;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({
  task,
  allTasks = [],
  onSelectTask,
  onToggleComplete,
  onEditTask,
  onTogglePinCountdown,
  onDeleteTask,
  onToggleChecklistItem,
  onOpenZenMode,
  onToggleFocus,
  onStopAndLogFocus,
  onRestartFocus,
  showSwitcher = false,
}) => {
  const [countdown, setCountdown] = useState<CountdownState>(calculateTaskCountdown(task));

  useEffect(() => {
    setCountdown(calculateTaskCountdown(task));
    const interval = setInterval(() => {
      setCountdown(calculateTaskCountdown(task));
    }, 1000);
    return () => clearInterval(interval);
  }, [task]);

  const handleComplete = (taskId: string) => {
    if (!task.completed) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#18181b', '#3b82f6', '#10b981'],
        });
      } catch {
        // ignore
      }
    }
    onToggleComplete(taskId);
  };

  const isCompleted = task.completed;
  const isOverdue = countdown.isOverdue && !isCompleted;
  const isFocusRunning = !!task.isFocusRunning;
  const focusSeconds = task.focusSeconds || 0;
  const taskColor = getTaskColor(task);

  return (
    <div
      id={`countdown-card-${task.id}`}
      style={{
        borderTop: `3.5px solid ${taskColor}`,
      }}
      className={`bg-white dark:bg-zinc-900 border rounded-xl p-3.5 sm:p-4 shadow-xs relative overflow-hidden transition-all duration-200 ${
        isFocusRunning
          ? 'ring-2 ring-sky-400 border-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.22)] bg-sky-50/10 dark:border-sky-500/50 dark:bg-sky-500/10'
          : isCompleted
          ? 'border-zinc-200/80 bg-zinc-50/40 opacity-90 dark:border-zinc-800/80 dark:bg-zinc-800/40'
          : isOverdue
          ? 'border-rose-200 bg-rose-50/10 dark:border-rose-500/30 dark:bg-rose-500/10'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      }`}
    >
      <div className="space-y-2.5">
        {/* Top Bar: COUNTDOWN badge, Status badge, Category pill & Top Right Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* COUNTDOWN Badge with Task Theme Color */}
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-2xs"
              style={{
                backgroundColor: `${taskColor}12`,
                borderColor: `${taskColor}35`,
                color: taskColor,
              }}
            >
              <Clock className="w-3 h-3" style={{ color: taskColor }} />
              COUNTDOWN
            </span>

            {/* Active Focus Session Live Indicator */}
            {isFocusRunning && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500 text-white shadow-xs animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping dark:bg-zinc-900" />
                Focus Active
              </span>
            )}

            {/* Status Pill */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                  : isOverdue
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
                  : 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'
              }`}
            >
              {isCompleted ? 'Done' : isOverdue ? 'Overdue' : 'Active'}
            </span>

            {/* Category Pill */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 dark:text-zinc-400 dark:bg-zinc-800 dark:border-zinc-800">
              {task.category}
            </span>

            {/* Total Focus Logged Pill if > 0 */}
            {focusSeconds > 0 && !isFocusRunning && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30">
                <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                {formatSecondsToFriendly(focusSeconds)}
              </span>
            )}

            {/* Priority if urgent/high */}
            {task.priority !== 'low' && task.priority !== 'medium' && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                  task.priority === 'urgent'
                    ? 'bg-rose-100/70 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-amber-100/70 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                {task.priority}
              </span>
            )}
          </div>

          {/* Top Right Action Buttons: Zen Mode, Edit, Pin, Delete */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {onOpenZenMode && (
              <button
                type="button"
                onClick={() => onOpenZenMode(task)}
                className="px-2 py-1 text-[11px] font-bold text-sky-700 hover:text-sky-950 bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 group min-h-[30px] dark:text-sky-300 dark:hover:text-sky-300 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:border-sky-500/30"
                title="Open full-screen Zen Focus Mode"
              >
                <Flame className="w-3 h-3 text-sky-500 group-hover:scale-110 transition-transform dark:text-sky-400" />
                <span>Zen</span>
              </button>
            )}

            {onTogglePinCountdown && (
              <button
                type="button"
                onClick={() => onTogglePinCountdown(task.id)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer min-h-[30px] min-w-[30px] flex items-center justify-center ${
                  task.pinnedCountdown
                    ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-2xs dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                title={task.pinnedCountdown ? 'Unpin countdown' : 'Pin countdown to top'}
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onEditTask(task)}
              className="p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer min-h-[30px] min-w-[30px] flex items-center justify-center dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              title="Edit task"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {onDeleteTask && (
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                className="p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-rose-50 hover:border-rose-200 text-zinc-400 hover:text-rose-600 transition-all cursor-pointer min-h-[30px] min-w-[30px] flex items-center justify-center dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-rose-500/10 dark:hover:border-rose-500/30 dark:text-zinc-500 dark:hover:text-rose-400"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Task Title & Description */}
        <div className="space-y-1">
          <h3
            onClick={() => onSelectTask && onSelectTask(task)}
            className={`text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 leading-snug cursor-pointer hover:underline ${
              isCompleted ? 'line-through text-zinc-400 dark:text-zinc-500' : ''
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed dark:text-zinc-400">
              {task.description}
            </p>
          )}

          {/* Checklist preview */}
          {task.checklist && task.checklist.length > 0 && (
            <div className="pt-1.5 space-y-1">
              {task.checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    onToggleChecklistItem && onToggleChecklistItem(task.id, item.id)
                  }
                  className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  <div
                    className={`w-3 h-3 rounded border flex items-center justify-center ${
                      item.done
                        ? 'bg-zinc-800 border-zinc-800 text-white'
                        : 'border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {item.done && <Check className="w-2 h-2" />}
                  </div>
                  <span className={item.done ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Date & Time with calendar & clock icons */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-medium pt-0.5 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>{formatFriendlyDate(task.date)}</span>
            </div>
            <span className="text-zinc-300">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>{formatTime(task.time)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Colored Countdown Progress Bar */}
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold flex items-center gap-1.5" style={{ color: taskColor }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: taskColor }} />
              <span>{countdown.formattedString}</span>
            </span>
            <span className="font-mono text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
              {countdown.progress}% elapsed
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/70 p-[1px] dark:bg-zinc-700 dark:border-zinc-800/70">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.max(3, Math.min(100, countdown.progress))}%`,
                backgroundColor: taskColor,
              }}
            />
          </div>
        </div>

        {/* 4 Digital Countdown Boxes */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center font-mono">
          {/* Days */}
          <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center dark:bg-zinc-800 dark:border-zinc-800/90">
            <span className="text-base sm:text-lg font-bold text-zinc-900 block leading-none dark:text-zinc-50">
              {String(countdown.days).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider mt-1 dark:text-zinc-500">
              DAYS
            </span>
          </div>

          {/* Hours */}
          <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center dark:bg-zinc-800 dark:border-zinc-800/90">
            <span className="text-base sm:text-lg font-bold text-zinc-900 block leading-none dark:text-zinc-50">
              {String(countdown.hours).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider mt-1 dark:text-zinc-500">
              HOURS
            </span>
          </div>

          {/* Mins */}
          <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center dark:bg-zinc-800 dark:border-zinc-800/90">
            <span className="text-base sm:text-lg font-bold text-zinc-900 block leading-none dark:text-zinc-50">
              {String(countdown.minutes).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider mt-1 dark:text-zinc-500">
              MINS
            </span>
          </div>

          {/* Secs (Themed colored box with white text) */}
          <div
            style={{ backgroundColor: taskColor }}
            className="text-white border border-transparent rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center shadow-xs transition-colors"
          >
            <span className="text-base sm:text-lg font-bold text-white block leading-none">
              {String(countdown.seconds).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold text-white/80 tracking-wider mt-1">
              SECS
            </span>
          </div>
        </div>

        {/* Action Button Row: Adjacent Focus count-up section (with Red Circle Restart button) and "✓ Mark as Done" */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Primary "Start Focus" (Count-Up) Controls Section */}
          <div className="flex items-center gap-1.5">
            {isFocusRunning ? (
              <button
                type="button"
                onClick={() => onToggleFocus && onToggleFocus(task.id)}
                className="flex-1 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer animate-pulse active:scale-[0.99]"
                title="Pause active focus session"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="truncate">Pause ({formatSecondsToHMS(focusSeconds)})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleFocus && onToggleFocus(task.id)}
                disabled={isCompleted}
                className={`flex-1 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99] ${
                  isCompleted
                    ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-500 dark:border-zinc-800'
                    : focusSeconds > 0
                    ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 shadow-2xs dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20 dark:border-sky-500/30'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200/90 shadow-2xs dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200 dark:border-zinc-800/90'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current text-sky-600 dark:text-sky-400" />
                <span className="truncate">
                  {focusSeconds > 0
                    ? `Resume (${formatSecondsToHMS(focusSeconds)})`
                    : '▶ Start Focus'}
                </span>
              </button>
            )}

            {/* Second Button for Count-Up: Red Circle button that resets/restarts timer and provides "Start Focus" option again */}
            <button
              type="button"
              onClick={() => onRestartFocus && onRestartFocus(task.id)}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center shrink-0 shadow-xs border border-rose-600 transition-all cursor-pointer group min-w-[40px]"
              title="Restart focus timer & reset to 'Start Focus'"
            >
              <RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5 group-hover:-rotate-45 transition-transform" />
            </button>

            {/* Stop & Log button if focus is currently running */}
            {isFocusRunning && onStopAndLogFocus && (
              <button
                type="button"
                onClick={() => onStopAndLogFocus(task.id)}
                className="p-2.5 min-h-[42px] rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-all cursor-pointer active:scale-95 shrink-0 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300 dark:border-zinc-800"
                title="Stop and log focus session"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
          </div>

          {/* Mark as Done / Incomplete Button */}
          <button
            type="button"
            onClick={() => handleComplete(task.id)}
            className={`py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99] ${
              isCompleted
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:border-zinc-800'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isCompleted ? 'Mark as Incomplete' : '✓ Mark as Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
