import React from 'react';
import { Task } from '../types';
import { Clock, Calendar } from 'lucide-react';
import { CountdownCard } from './CountdownCard';

interface TaskCountdownHeroProps {
  task: Task | null;
  allTasks: Task[];
  onSelectTask: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onEditTask: (task: Task) => void;
}

export const TaskCountdownHero: React.FC<TaskCountdownHeroProps> = ({
  task,
  allTasks,
  onSelectTask,
  onToggleComplete,
  onOpenNewTaskModal,
  onEditTask,
}) => {
  if (!task) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-700 border border-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-50">No Active Countdown</h2>
              <p className="text-xs text-zinc-400">Pick any date or task to start tracking.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            Assign Task
          </button>
        </div>
      </div>
    );
  }

  return (
    <CountdownCard
      task={task}
      allTasks={allTasks}
      onSelectTask={onSelectTask}
      onToggleComplete={onToggleComplete}
      onEditTask={onEditTask}
      showSwitcher={true}
    />
  );
};

