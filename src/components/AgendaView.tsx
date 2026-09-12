import React from 'react';
import { Task } from '../types';
import { calculateTaskCountdown, formatFriendlyDate, formatTime } from '../utils/dateUtils';
import { Clock, Calendar, Check, AlertCircle, ArrowUpRight, Trash2, Edit3, Pin } from 'lucide-react';

interface AgendaViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectDate: (dateStr: string) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  tasks,
  onSelectTask,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onSelectDate,
}) => {
  // Sort tasks chronologically by date and time
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = `${a.date}T${a.time || '23:59'}`;
    const dateB = `${b.date}T${b.time || '23:59'}`;
    return dateA.localeCompare(dateB);
  });

  if (sortedTasks.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <Calendar className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-50">No scheduled tasks</h3>
        <p className="text-xs text-zinc-400 mt-1">Select any date on the calendar to assign a new task.</p>
      </div>
    );
  }

  // Group by date
  const groupedTasks: Record<string, Task[]> = {};
  for (const t of sortedTasks) {
    if (!groupedTasks[t.date]) groupedTasks[t.date] = [];
    groupedTasks[t.date].push(t);
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedTasks).map(([dateStr, dateTasks]) => (
        <div key={dateStr} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-300" />
              <h3 className="text-sm font-bold text-zinc-50">{formatFriendlyDate(dateStr)}</h3>
              <span className="text-xs font-semibold text-zinc-500">
                ({dateTasks.length} task{dateTasks.length === 1 ? '' : 's'})
              </span>
            </div>

            <button
              onClick={() => onSelectDate(dateStr)}
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-50 flex items-center gap-1 cursor-pointer"
            >
              View Day <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-zinc-800">
            {dateTasks.map((task) => {
              const countdown = calculateTaskCountdown(task);
              const isOverdue = countdown.isOverdue && !task.completed;

              return (
                <div
                  key={task.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-zinc-800/70 rounded-xl px-2 -mx-2 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleComplete(task.id)}
                      className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'
                      }`}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.isFocusRunning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500 text-white animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-ping" />
                            Focus Active
                          </span>
                        )}
                        <h4
                          onClick={() => onSelectTask(task)}
                          className={`text-sm font-bold text-zinc-50 cursor-pointer hover:underline ${
                            task.completed ? 'line-through text-zinc-500' : ''
                          }`}
                        >
                          {task.title}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400 border border-zinc-800">
                          {task.category}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            task.priority === 'urgent'
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                              : task.priority === 'high'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(task.time)}
                        </span>
                        <span>•</span>
                        <span
                          className={`font-medium ${
                            task.completed
                              ? 'text-emerald-400'
                              : isOverdue
                              ? 'text-rose-400 font-semibold'
                              : 'text-zinc-400'
                          }`}
                        >
                          {countdown.formattedString}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-600/60 rounded-lg transition-all cursor-pointer"
                      title="Edit task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
