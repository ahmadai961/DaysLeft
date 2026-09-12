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
  Sparkles,
} from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onOpenNewTaskModal: () => void;
  onOpenAutoScheduler: () => void;
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
  onOpenAutoScheduler,
  searchQuery,
  onSearchChange,
  totalTaskCount,
  pendingTaskCount,
}) => {
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20 backdrop-blur-md bg-zinc-900/95">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 space-y-2.5 sm:space-y-3">
        {/* Row 1: Brand & Top Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Stats */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-50 leading-tight truncate">
                Calendar & Countdown
              </h1>
              <span className="text-[10px] sm:text-[11px] text-zinc-400 font-medium block truncate">
                {pendingTaskCount} active • {totalTaskCount} total tasks
              </span>
            </div>
          </div>

          {/* Desktop & Mobile Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="sm:hidden p-2 rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-700 transition-all cursor-pointer"
              title="Search tasks"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Desktop Search Input */}
            <div className="relative hidden sm:block w-44 md:w-56">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-zinc-800 hover:bg-zinc-700/70 focus:bg-zinc-900 text-xs text-zinc-200 placeholder-zinc-400 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 text-xs font-bold px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* AI Auto-Scheduler Action Button */}
            <button
              type="button"
              onClick={onOpenAutoScheduler}
              className="px-2.5 sm:px-3.5 py-2 min-h-[38px] sm:min-h-[40px] bg-gradient-to-r from-indigo-500/10 to-sky-500/10 hover:from-indigo-500/20 hover:to-sky-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95 shrink-0 group"
              title="Decompose goal with AI Scheduling Agent"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 transition-transform group-hover:rotate-12" />
              <span className="hidden sm:inline">✨ AI Auto-Scheduler</span>
              <span className="inline sm:hidden">✨ AI Scheduler</span>
            </button>

            {/* Add Task Primary Action */}
            <button
              onClick={onOpenNewTaskModal}
              className="px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span className="font-semibold">Add Task</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Input dropdown when open */}
        {isMobileSearchOpen && (
          <div className="relative sm:hidden pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search tasks by title, category, priority..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-800 focus:bg-zinc-900 text-xs text-zinc-200 placeholder-zinc-400 border border-zinc-700 rounded-xl pl-8 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-zinc-100 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-sm font-bold p-1"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Row 2: Month / Year Controls & View Mode Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-zinc-800 border border-zinc-800/90 rounded-xl p-1 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={onPrevMonth}
                className="p-2 sm:p-1.5 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 hover:shadow-xs transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-bold text-zinc-50 px-2 min-w-[110px] sm:min-w-[130px] text-center select-none truncate">
                {monthName} {year}
              </span>
              <button
                onClick={onNextMonth}
                className="p-2 sm:p-1.5 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 hover:shadow-xs transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onToday}
              className="px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-50 hover:bg-zinc-900 rounded-lg transition-all border-l border-zinc-800/80 cursor-pointer min-h-[32px] flex items-center"
            >
              Today
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-700/90 border border-zinc-800 p-0.5 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
            {(['month', 'week', 'agenda'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer text-center ${
                  viewMode === mode
                    ? 'bg-zinc-600 text-zinc-50 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
