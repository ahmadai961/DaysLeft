import React from 'react';
import { Task, FilterTab } from '../types';
import { calculateTaskCountdown } from '../utils/dateUtils';
import { Clock, CalendarPlus, Plus, Calendar } from 'lucide-react';
import { CountdownCard } from './CountdownCard';

interface CountdownListProps {
  tasks: Task[];
  totalTasksCount?: number;
  onAddNewTask?: () => void;
  onSelectTask: (task: Task) => void;
  onSelectDate: (dateStr: string) => void;
  onToggleComplete: (taskId: string) => void;
  onTogglePinCountdown: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleChecklistItem?: (taskId: string, itemId: string) => void;
  onOpenZenMode?: (task: Task) => void;
  onToggleFocus?: (taskId: string) => void;
  onStopAndLogFocus?: (taskId: string) => void;
  onRestartFocus?: (taskId: string) => void;
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
}

export const CountdownList: React.FC<CountdownListProps> = ({
  tasks,
  totalTasksCount,
  onAddNewTask,
  onSelectTask,
  onSelectDate,
  onToggleComplete,
  onTogglePinCountdown,
  onEditTask,
  onDeleteTask,
  onToggleChecklistItem,
  onOpenZenMode,
  onToggleFocus,
  onStopAndLogFocus,
  onRestartFocus,
  activeFilter,
  onFilterChange,
}) => {
  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const countdown = calculateTaskCountdown(t);
    if (activeFilter === 'completed') return t.completed;
    if (activeFilter === 'today') return !t.completed && countdown.isToday;
    if (activeFilter === 'overdue') return !t.completed && countdown.isOverdue;
    if (activeFilter === 'upcoming') return !t.completed && !countdown.isOverdue;
    return true; // 'all'
  });

  // Check whether the user has zero tasks in total
  const isOverallEmpty = totalTasksCount !== undefined ? totalTasksCount === 0 : tasks.length === 0;

  // Sort by urgency (nearest deadline first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    const timeA = new Date(`${a.date}T${a.time || '23:59'}`).getTime();
    const timeB = new Date(`${b.date}T${b.time || '23:59'}`).getTime();
    return timeA - timeB;
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-4 w-full min-w-0 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2 dark:text-zinc-50">
            <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            All Countdowns
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 dark:text-zinc-400">
            Real-time countdown timers synchronized with your calendar tasks.
          </p>
        </div>

        {/* Filter Pills */}
        {!isOverallEmpty && (
          <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl overflow-x-auto max-w-full dark:bg-zinc-700/80">
            {(['all', 'upcoming', 'today', 'overdue', 'completed'] as FilterTab[]).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => onFilterChange(tab)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === tab
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-600 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zero tasks total: clean empty-state placeholder */}
      {isOverallEmpty ? (
        <div className="py-10 px-4 text-center flex flex-col items-center justify-center border-2 border-dashed border-zinc-200/90 rounded-2xl bg-zinc-50/60 dark:border-zinc-800/90 dark:bg-zinc-800/60">
          <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 shadow-xs flex items-center justify-center mb-3 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
            <CalendarPlus className="w-6 h-6 text-zinc-800 dark:text-zinc-200" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1 dark:text-zinc-50">
            No countdowns or tasks yet
          </h3>
          <p className="text-xs text-zinc-500 max-w-[280px] leading-relaxed mb-4 dark:text-zinc-400">
            Add your first task or select a date on the calendar to start tracking live countdowns and focus sessions.
          </p>
          {onAddNewTask && (
            <button
              type="button"
              onClick={onAddNewTask}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Task</span>
            </button>
          )}
          <div className="mt-4 pt-3 border-t border-zinc-200/70 w-full max-w-[260px] flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-500">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 dark:text-zinc-500" />
            <span>Click any day on the calendar to schedule</span>
          </div>
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="py-10 text-center text-zinc-400 dark:text-zinc-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
          <p className="text-xs font-medium">No tasks found for the '{activeFilter}' filter.</p>
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className="mt-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 underline cursor-pointer dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            Show All Countdowns
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <CountdownCard
              key={task.id}
              task={task}
              onSelectTask={(t) => {
                onSelectDate(t.date);
                onSelectTask(t);
              }}
              onToggleComplete={onToggleComplete}
              onTogglePinCountdown={onTogglePinCountdown}
              onEditTask={onEditTask || (() => {})}
              onDeleteTask={onDeleteTask}
              onToggleChecklistItem={onToggleChecklistItem}
              onOpenZenMode={onOpenZenMode}
              onToggleFocus={onToggleFocus}
              onStopAndLogFocus={onStopAndLogFocus}
              onRestartFocus={onRestartFocus}
              showSwitcher={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};


