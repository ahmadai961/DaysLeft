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
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-zinc-200 min-h-[380px]">
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
              className={`p-3 flex flex-col justify-between transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-zinc-50/80 ring-2 ring-zinc-900 ring-inset z-10'
                  : 'bg-white hover:bg-zinc-50/50'
              }`}
            >
              {/* Day Header */}
              <div className="border-b border-zinc-100 pb-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {weekdayShort}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-zinc-900 text-white'
                          : isSelected
                          ? 'bg-zinc-200 text-zinc-900'
                          : 'text-zinc-800'
                      }`}
                    >
                      {dayItem.dayNumber}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-semibold text-zinc-500">Today</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAddTask(dayItem.dateString);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 text-zinc-600 rounded-md transition-all cursor-pointer"
                  title="Add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Tasks List */}
              <div className="flex-1 my-3 space-y-2 overflow-y-auto max-h-[300px]">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-6 text-zinc-300">
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
                            ? 'bg-sky-50 text-sky-950 border-sky-400 font-semibold shadow-xs ring-1 ring-sky-300'
                            : task.completed
                            ? 'bg-zinc-50 text-zinc-400 border-zinc-200/60 line-through'
                            : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-300 hover:shadow-xs'
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
                          <div className="flex items-center gap-1 text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(task.time)}</span>
                          </div>
                          {isFocus && (
                            <span className="text-[9px] font-bold text-sky-700 uppercase tracking-wider">
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
              <div className="pt-2 border-t border-zinc-100 text-[10px] font-medium text-zinc-400 flex items-center justify-between">
                <span>{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}</span>
                <span className="text-zinc-500">{dayTasks.filter(t => t.completed).length} done</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
