import React from 'react';
import { Task } from '../types';
import { getWeekDays, formatTime, getTaskColor } from '../utils/dateUtils';
import { Plus, Check, Clock, Calendar } from 'lucide-react';

interface WeekCalendarProps {
  selectedDate: Date;
  selectedDateStr: string;
  tasks: Task[];
  onSelectDate: (dateStr: string) => void;
  onQuickAddTask: (dateStr: string) => void;
  onSelectTask: (task: Task) => void;
}

export const WeekCalendar: React.FC<WeekCalendarProps> = ({
  selectedDate,
  selectedDateStr,
  tasks,
  onSelectDate,
  onQuickAddTask,
  onSelectTask,
}) => {
  const weekDays = getWeekDays(selectedDate, selectedDateStr, tasks);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-zinc-800 min-h-[auto] md:min-h-[380px]">
        {weekDays.map((dayItem) => {
          const isSelected = dayItem.dateString === selectedDateStr;
          const isToday = dayItem.isToday;
          const dayTasks = dayItem.tasks;
          const weekdayShort = dayItem.date.toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div
              key={dayItem.dateString}
              onClick={() => {
                onSelectDate(dayItem.dateString);
                onQuickAddTask(dayItem.dateString);
              }}
              className={`p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-zinc-800/80 ring-2 ring-zinc-100 ring-inset z-10'
                  : 'bg-zinc-900 hover:bg-zinc-800/50'
              }`}
            >
              {/* Day Header */}
              <div className="border-b border-zinc-800 pb-1.5 sm:pb-2 flex items-center justify-between">
                <div className="flex items-center sm:block gap-2 sm:gap-0">
                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    {weekdayShort}
                  </div>
                  <div className="flex items-center gap-1.5 sm:mt-0.5">
                    <span
                      className={`text-xs sm:text-sm font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : isSelected
                          ? 'bg-zinc-600 text-zinc-50'
                          : 'text-zinc-200'
                      }`}
                    >
                      {dayItem.dayNumber}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-semibold text-zinc-400">Today</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAddTask(dayItem.dateString);
                  }}
                  className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-600 text-zinc-400 rounded-md transition-all cursor-pointer"
                  title="Add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Tasks List */}
              <div className="flex-1 my-2 sm:my-3 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[220px] md:max-h-[300px]">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-2 sm:py-6 text-zinc-300">
                    <span className="text-xs">No tasks</span>
                  </div>
                ) : (
                  dayTasks.map((task) => {
                    const isFocus = task.isFocusRunning;
                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(dayItem.dateString);
                          onSelectTask(task);
                        }}
                        className={`p-2 rounded-xl text-xs border transition-all ${
                          isFocus
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/50 font-semibold shadow-xs ring-1 ring-sky-300'
                            : task.completed
                            ? 'bg-zinc-800 text-zinc-500 border-zinc-800/60 line-through'
                            : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-zinc-700 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold truncate">{task.title}</span>
                          {isFocus ? (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: task.completed ? '#a1a1aa' : getTaskColor(task),
                              }}
                              className="w-2 h-2 rounded-full shrink-0"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(task.time)}</span>
                          </div>
                          {isFocus && (
                            <span className="text-[9px] font-bold text-sky-300 uppercase tracking-wider">
                              Focusing
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Day Bottom Summary */}
              <div className="pt-2 border-t border-zinc-800 text-[10px] font-medium text-zinc-500 flex items-center justify-between">
                <span>{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}</span>
                <span className="text-zinc-400">{dayTasks.filter(t => t.completed).length} done</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
