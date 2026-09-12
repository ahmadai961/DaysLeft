import React, { useState } from 'react';
import { Task } from '../types';
import { formatSecondsToFriendly, formatMinutesToFriendly, formatDateToISO } from '../utils/dateUtils';
import {
  BarChart3,
  Flame,
  Zap,
  CheckCircle2,
  Briefcase,
  BookOpen,
  HeartPulse,
  DollarSign,
  FolderKanban,
  User,
  Sparkles,
  TrendingUp,
  Clock,
  Award,
} from 'lucide-react';

interface ProductivityAnalyticsProps {
  tasks: Task[];
}

interface CategoryConfig {
  name: string;
  color: string;
  bgLight: string;
  borderLight: string;
  textColor: string;
  barColor: string;
  icon: React.ReactNode;
}

export const ProductivityAnalytics: React.FC<ProductivityAnalyticsProps> = ({ tasks }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today'>('all');
  const todayStr = formatDateToISO(new Date());

  // Define Category Styles & Icons
  const categoryConfigs: Record<string, CategoryConfig> = {
    Work: {
      name: 'Work',
      color: '#F59E0B',
      bgLight: 'bg-amber-50 dark:bg-amber-500/10',
      borderLight: 'border-amber-200/90 dark:border-amber-500/30',
      textColor: 'text-amber-800 dark:text-amber-300',
      barColor: 'bg-amber-500',
      icon: <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    },
    Study: {
      name: 'Study',
      color: '#6366F1',
      bgLight: 'bg-indigo-50 dark:bg-indigo-500/10',
      borderLight: 'border-indigo-200/90 dark:border-indigo-500/30',
      textColor: 'text-indigo-800 dark:text-indigo-300',
      barColor: 'bg-indigo-500',
      icon: <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
    },
    Health: {
      name: 'Health / Workout',
      color: '#10B981',
      bgLight: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderLight: 'border-emerald-200/90 dark:border-emerald-500/30',
      textColor: 'text-emerald-800 dark:text-emerald-300',
      barColor: 'bg-emerald-500',
      icon: <HeartPulse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    },
    Finance: {
      name: 'Finance',
      color: '#F43F5E',
      bgLight: 'bg-rose-50 dark:bg-rose-500/10',
      borderLight: 'border-rose-200/90 dark:border-rose-500/30',
      textColor: 'text-rose-800 dark:text-rose-300',
      barColor: 'bg-rose-500',
      icon: <DollarSign className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
    },
    Project: {
      name: 'Project',
      color: '#8B5CF6',
      bgLight: 'bg-purple-50 dark:bg-purple-500/10',
      borderLight: 'border-purple-200/90 dark:border-purple-500/30',
      textColor: 'text-purple-800 dark:text-purple-300',
      barColor: 'bg-purple-500',
      icon: <FolderKanban className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
    },
    Personal: {
      name: 'Personal',
      color: '#06B6D4',
      bgLight: 'bg-cyan-50 dark:bg-cyan-500/10',
      borderLight: 'border-cyan-200/90 dark:border-cyan-500/30',
      textColor: 'text-cyan-800 dark:text-cyan-300',
      barColor: 'bg-cyan-500',
      icon: <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
    },
  };

  // Filter tasks if "today" selected
  const relevantTasks = timeFilter === 'today'
    ? tasks.filter((t) => t.date === todayStr)
    : tasks;

  // Aggregate Category Data
  const categoriesList = ['Work', 'Study', 'Health', 'Finance', 'Project', 'Personal'];

  let totalFocusSecondsOverall = 0;
  let totalTimeSavedMinutesOverall = 0;
  let totalCompletedTasks = 0;
  let earlyCompletedTasksCount = 0;

  // Compute all-time & filtered category aggregates
  const categoryStats = categoriesList.map((catKey) => {
    const allCatTasks = tasks.filter((t) => t.category === catKey);
    const filteredCatTasks = relevantTasks.filter((t) => t.category === catKey);

    const totalSeconds = allCatTasks.reduce((acc, t) => acc + (t.focusSeconds || 0), 0);
    const filteredSeconds = filteredCatTasks.reduce((acc, t) => acc + (t.focusSeconds || 0), 0);
    const totalSavedMinutes = allCatTasks.reduce((acc, t) => acc + (t.timeSavedMinutes || 0), 0);

    const completed = filteredCatTasks.filter((t) => t.completed).length;
    const totalCount = filteredCatTasks.length;

    totalFocusSecondsOverall += (timeFilter === 'today' ? filteredSeconds : totalSeconds);
    totalTimeSavedMinutesOverall += totalSavedMinutes;
    totalCompletedTasks += completed;

    return {
      key: catKey,
      config: categoryConfigs[catKey],
      totalSeconds,
      filteredSeconds,
      displaySeconds: timeFilter === 'today' ? filteredSeconds : totalSeconds,
      totalSavedMinutes,
      completed,
      totalCount,
    };
  });

  // Calculate early completed count
  earlyCompletedTasksCount = tasks.filter((t) => (t.timeSavedMinutes || 0) > 0 && t.completed).length;

  const maxCategorySeconds = Math.max(...categoryStats.map((c) => c.displaySeconds), 3600);

  return (
    <section className="mt-12 pt-8 border-t border-zinc-200/90 text-zinc-900 dark:border-zinc-800/90 dark:text-zinc-50">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Productivity & Category Overview
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 dark:text-zinc-400">
            Real-time focus effort distribution, category breakdown, and cumulative time saved bank.
          </p>
        </div>

        {/* Today vs All-Time Pill Toggle */}
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/80 self-start sm:self-auto shrink-0 text-xs font-semibold dark:bg-zinc-700 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-xs font-bold dark:bg-zinc-600 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            All-Time Summary
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeFilter === 'today'
                ? 'bg-white text-zinc-900 shadow-xs font-bold dark:bg-zinc-600 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Today Only
          </button>
        </div>
      </div>

      {/* Top Banner Row: Time Saved Bank & Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Dedicated "Time Saved" Bank (Electric Cyan Highlight Card) */}
        <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50 via-sky-50 to-white border-2 border-cyan-300 p-5 sm:p-6 shadow-sm dark:from-cyan-500/10 dark:via-sky-500/10 dark:to-zinc-900 dark:border-cyan-500/30">
          {/* Subtle background glow circle */}
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-cyan-400/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-100/80 border border-cyan-200 text-cyan-900 text-xs font-bold dark:bg-cyan-500/20 dark:border-cyan-500/30 dark:text-cyan-300">
                <Zap className="w-3.5 h-3.5 text-cyan-600 fill-cyan-500 dark:text-cyan-400" />
                <span>Time Saved Bank</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-cyan-950 tracking-tight dark:text-cyan-300">
                {totalTimeSavedMinutesOverall > 0
                  ? formatMinutesToFriendly(totalTimeSavedMinutesOverall)
                  : '0h 00m'}
                <span className="text-sm font-semibold text-cyan-700 ml-2 dark:text-cyan-300">Total Saved</span>
              </h3>
              <p className="text-xs text-cyan-800/80 leading-relaxed font-medium dark:text-cyan-300/80">
                Accumulated time earned by completing tasks and milestones ahead of target deadlines.
              </p>
            </div>

            {/* Quick Badges inside the Bank */}
            <div className="flex sm:flex-col gap-2 shrink-0">
              <div className="bg-white/80 backdrop-blur-xs border border-cyan-200/80 rounded-xl px-3.5 py-2 text-center shadow-2xs dark:bg-zinc-900/80 dark:border-cyan-500/30">
                <span className="text-xs text-cyan-900/70 font-semibold block dark:text-cyan-300/80">Early Completed</span>
                <span className="text-base sm:text-lg font-mono font-black text-cyan-700 dark:text-cyan-300">
                  {earlyCompletedTasksCount} {earlyCompletedTasksCount === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-cyan-200/80 rounded-xl px-3.5 py-2 text-center shadow-2xs dark:bg-zinc-900/80 dark:border-cyan-500/30">
                <span className="text-xs text-cyan-900/70 font-semibold block dark:text-cyan-300/80">Pacing Status</span>
                <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1 mt-0.5 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" /> High Efficiency
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Total Focus Time Card */}
        <div className="bg-zinc-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider dark:text-zinc-500">
              {timeFilter === 'today' ? "Today's Active Focus" : 'Total Logged Focus'}
            </span>
            <Flame className="w-5 h-5 text-amber-400" />
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-mono font-black tracking-tight text-white">
              {formatSecondsToFriendly(totalFocusSecondsOverall)}
            </div>
            <p className="text-xs text-zinc-400 mt-1 dark:text-zinc-500">
              Active deep work sessions tracked with count-up focus
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-400 font-medium dark:text-zinc-500">
            <span>Tasks Finished: <strong className="text-white">{totalCompletedTasks}</strong></span>
            <span>Active Items: <strong className="text-white">{tasks.length - totalCompletedTasks}</strong></span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {categoryStats.map((cat) => {
          const cfg = cat.config;
          const percentage = Math.min(100, Math.round((cat.displaySeconds / maxCategorySeconds) * 100));

          return (
            <div
              key={cat.key}
              className={`rounded-2xl border ${cfg.borderLight} bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all group`}
            >
              {/* Header: Icon & Category Name */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${cfg.bgLight} border ${cfg.borderLight} flex items-center justify-center`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-50 dark:group-hover:text-white">
                      {cfg.name}
                    </h4>
                    <span className="text-[11px] text-zinc-400 font-medium dark:text-zinc-500">
                      {cat.totalCount} {cat.totalCount === 1 ? 'task' : 'tasks'} ({cat.completed} done)
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${cfg.bgLight} ${cfg.textColor} border ${cfg.borderLight}`}
                >
                  {formatSecondsToFriendly(cat.displaySeconds)}
                </span>
              </div>

              {/* Progress Bar for relative focus allocation */}
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium dark:text-zinc-400">
                  <span>Relative Allocation</span>
                  <span className="font-mono">{percentage}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden dark:bg-zinc-700">
                  <div
                    className={`h-full ${cfg.barColor} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Footer Mini Stats */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 text-[11px] text-zinc-500 font-medium dark:border-zinc-800 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                  All-Time: {formatSecondsToFriendly(cat.totalSeconds)}
                </span>
                {cat.totalSavedMinutes > 0 && (
                  <span className="text-cyan-700 font-semibold flex items-center gap-0.5 dark:text-cyan-300">
                    <Sparkles className="w-3 h-3" />
                    +{formatMinutesToFriendly(cat.totalSavedMinutes)} saved
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
