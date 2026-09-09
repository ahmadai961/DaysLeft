import React from 'react';
import { Task, FilterTab } from '../types';
import { calculateTaskCountdown } from '../utils/dateUtils';
import { Clock } from 'lucide-react';
import { CountdownCard } from './CountdownCard';

interface CountdownListProps {
  tasks: Task[];
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

  // Sort by urgency (nearest deadline first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    const timeA = new Date(`${a.date}T${a.time || '23:59'}`).getTime();
    const timeB = new Date(`${b.date}T${b.time || '23:59'}`).getTime();
    return timeA - timeB;
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-700" />
            All Countdowns
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time countdown timers synchronized with your calendar tasks.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl overflow-x-auto">
          {(['all', 'upcoming', 'today', 'overdue', 'completed'] as FilterTab[]).map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => onFilterChange(tab)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Countdown Bars */}
      {sortedTasks.length === 0 ? (
        <div className="py-10 text-center text-zinc-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
          <p className="text-xs font-medium">No tasks found in this view filter.</p>
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

