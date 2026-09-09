import React from 'react';
import { CalendarViewMode } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onOpenNewTaskModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalTaskCount: number;
  pendingTaskCount: number;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  viewMode,
  onViewModeChange,
  onOpenNewTaskModal,
  searchQuery,
  onSearchChange,
  totalTaskCount,
  pendingTaskCount,
}) => {
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-20 backdrop-blur-md bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: App Title & Month Navigator */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 mr-1">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-zinc-900 leading-none">
                Calendar & Countdown
              </h1>
              <span className="text-[11px] text-zinc-500 font-medium">
                {pendingTaskCount} active • {totalTaskCount} total tasks
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-zinc-200 hidden sm:block" />

          {/* Month / Year Display & Controls */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/90 rounded-xl p-1">
            <button
              onClick={onPrevMonth}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-zinc-900 px-2 min-w-[120px] sm:min-w-[140px] text-center select-none">
              {monthName} {year}
            </span>
            <button
              onClick={onNextMonth}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onToday}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-white rounded-lg transition-all border-l border-zinc-200/80 cursor-pointer ml-0.5"
            >
              Today
            </button>
          </div>
        </div>

        {/* Right: Search, View Mode Switcher & Add Task */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48 md:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-xs text-zinc-800 placeholder-zinc-400 border border-zinc-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold px-1"
              >
                ×
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-100/90 border border-zinc-200 p-0.5 rounded-xl">
            {(['month', 'week', 'agenda'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Add Task Primary Action */}
          <button
            onClick={onOpenNewTaskModal}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};
