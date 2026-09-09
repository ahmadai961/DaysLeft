import React from 'react';
import { Task } from '../types';
import { formatLongDate } from '../utils/dateUtils';
import { Plus, Calendar } from 'lucide-react';
import { CountdownCard } from './CountdownCard';

interface SelectedDatePanelProps {
  selectedDateStr: string;
  tasks: Task[];
  onAddTask: (dateStr: string) => void;
  onSelectTask: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onTogglePinCountdown: (taskId: string) => void;
  onToggleChecklistItem?: (taskId: string, itemId: string) => void;
}

export const SelectedDatePanel: React.FC<SelectedDatePanelProps> = ({
  selectedDateStr,
  tasks,
  onAddTask,
  onSelectTask,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onTogglePinCountdown,
  onToggleChecklistItem,
}) => {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Date Header & Add Task Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-900" />
            <h2 className="text-base font-bold text-zinc-900">{formatLongDate(selectedDateStr)}</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {tasks.length === 0
              ? 'No tasks assigned for this date'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'} assigned`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAddTask(selectedDateStr)}
          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          Assign Task Here
        </button>
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="py-10 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-800">Free Schedule</h3>
          <p className="text-xs text-zinc-400 max-w-xs mt-1">
            There are no tasks scheduled for this day. Click &ldquo;Assign Task Here&rdquo; to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <CountdownCard
              key={task.id}
              task={task}
              onSelectTask={onSelectTask}
              onToggleComplete={onToggleComplete}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onTogglePinCountdown={onTogglePinCountdown}
              onToggleChecklistItem={onToggleChecklistItem}
              showSwitcher={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

