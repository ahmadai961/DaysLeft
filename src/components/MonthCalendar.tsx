import React from 'react';
import { Task } from '../types';
import { CalendarDay, getMonthDays, formatTime, getTaskColor } from '../utils/dateUtils';
import { Plus, Check, Clock, AlertCircle } from 'lucide-react';

interface MonthCalendarProps {
  currentDate: Date;
  selectedDateStr: string;
  tasks: Task[];
  onSelectDate: (dateStr: string) => void;
  onQuickAddTask: (dateStr: string) => void;
  onSelectTask: (task: Task) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  currentDate,
  selectedDateStr,
  tasks,
  onSelectDate,
  onQuickAddTask,
  onSelectTask,
}) => {
  const days = getMonthDays(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    selectedDateStr,
    tasks
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-800/70 text-center text-[11px] sm:text-xs font-bold text-zinc-400 py-2">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`${idx === 0 || idx === 6 ? 'text-zinc-500' : 'text-zinc-300'}`}
          >
            <span className="sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-zinc-800/70 bg-zinc-600/40">
        {days.map((dayItem) => {
          const isSelected = dayItem.dateString === selectedDateStr;
          const isToday = dayItem.isToday;
          const isCurrentMonth = dayItem.isCurrentMonth;
          const dayTasks = dayItem.tasks;
          const completedCount = dayTasks.filter((t) => t.completed).length;

          return (
            <div
              key={dayItem.dateString}
              onClick={() => {
                onSelectDate(dayItem.dateString);
                onQuickAddTask(dayItem.dateString);
              }}
              className={`min-h-[66px] sm:min-h-[110px] md:min-h-[125px] p-1 sm:p-2 flex flex-col justify-between transition-all duration-150 cursor-pointer group relative ${
                isSelected
                  ? 'bg-zinc-800/90 ring-2 ring-zinc-100 ring-inset z-10'
                  : isCurrentMonth
                  ? 'bg-zinc-900 hover:bg-zinc-800/60'
                  : 'bg-zinc-800/40 text-zinc-500 hover:bg-zinc-800/80'
              }`}
            >
              {/* Day Cell Top Bar: Date Number & Quick Add */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isSelected
                        ? 'bg-zinc-600 text-zinc-50'
                        : isCurrentMonth
                        ? 'text-zinc-200 group-hover:text-white'
                        : 'text-zinc-500'
                    }`}
                  >
                    {dayItem.dayNumber}
                  </span>

                  {isToday && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-tight hidden md:inline">
                      Today
                    </span>
                  )}
                </div>

                {/* Quick Add Button on Hover / Tablet */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAddTask(dayItem.dateString);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 sm:p-1 hover:bg-zinc-600 text-zinc-400 rounded-md transition-all cursor-pointer hidden sm:block"
                  title={`Add task for ${dayItem.dateString}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mobile View (< sm): Compact Dot Preview Indicator */}
              <div className="sm:hidden flex-1 my-1 flex flex-col items-center justify-center">
                {dayTasks.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap justify-center max-w-full">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        style={{
                          backgroundColor: t.completed ? '#a1a1aa' : getTaskColor(t),
                        }}
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          t.isFocusRunning ? 'animate-ping ring-2 ring-sky-400' : ''
                        }`}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] font-bold text-zinc-400 leading-none">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop/Tablet View (>= sm): Full Task Chips in Day Cell */}
              <div className="hidden sm:block flex-1 my-1.5 space-y-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((t) => {
                  const isDone = t.completed;
                  const isFocus = t.isFocusRunning;
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(dayItem.dateString);
                        onSelectTask(t);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[11px] truncate flex items-center gap-1 border transition-all ${
                        isFocus
                          ? 'bg-sky-500/10 text-sky-300 border-sky-500/50 font-semibold shadow-xs ring-1 ring-sky-300'
                          : isDone
                          ? 'bg-zinc-700 text-zinc-500 border-zinc-800 line-through'
                          : t.priority === 'urgent'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 font-medium'
                          : t.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-medium'
                          : 'bg-zinc-800 text-zinc-200 border-zinc-800/90'
                      }`}
                      title={`${t.title} (${t.time ? formatTime(t.time) : 'All Day'}) ${
                        isFocus ? '• Focus Session In Progress' : ''
                      }`}
                    >
                      {isFocus ? (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: isDone ? '#a1a1aa' : getTaskColor(t),
                          }}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                        />
                      )}
                      <span className="truncate">{t.title}</span>
                    </div>
                  );
                })}

                {dayTasks.length > 3 && (
                  <div className="text-[10px] font-semibold text-zinc-400 px-1">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>

              {/* Day Cell Bottom Indicator */}
              {dayTasks.length > 0 && (
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-zinc-500 font-medium pt-0.5">
                  <div className="flex items-center gap-1 truncate">
                    {completedCount === dayTasks.length ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5 shrink-0" />
                        <span className="hidden sm:inline">All Done</span>
                      </span>
                    ) : (
                      <span>
                        {completedCount}/{dayTasks.length} <span className="hidden sm:inline">done</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
