/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Task, CalendarViewMode, FilterTab } from './types';
import { formatDateToISO, calculateCompletionTimeSaved } from './utils/dateUtils';
import { loadTasksFromStorage, saveTasksToStorage } from './utils/initialTasks';
import { CalendarHeader } from './components/CalendarHeader';
import { MonthCalendar } from './components/MonthCalendar';
import { WeekCalendar } from './components/WeekCalendar';
import { AgendaView } from './components/AgendaView';
import { CountdownList } from './components/CountdownList';
import { TaskModal } from './components/TaskModal';
import { ZenFocusOverlay } from './components/ZenFocusOverlay';
import { TaskCompletionModal } from './components/TaskCompletionModal';
import { ProductivityAnalytics } from './components/ProductivityAnalytics';
import { Clock, Calendar as CalendarIcon, Plus, ChevronRight, Check, Layers } from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() =>
    formatDateToISO(new Date())
  );
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [zenTask, setZenTask] = useState<Task | null>(null);
  const [completedTaskForModal, setCompletedTaskForModal] = useState<Task | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(() =>
    formatDateToISO(new Date())
  );
  const [mobileTab, setMobileTab] = useState<'calendar' | 'countdowns' | 'both'>('both');

  // Sync tasks to localStorage whenever modified
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  // Live session focus ticker for all running tasks
  useEffect(() => {
    const hasRunningSession = tasks.some((t) => t.isFocusRunning);
    if (!hasRunningSession) return;

    const interval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          if (t.isFocusRunning) {
            return {
              ...t,
              focusSeconds: (t.focusSeconds || 0) + 1,
            };
          }
          return t;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks]);

  // Selected date object
  const selectedDateObj = useMemo(() => {
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateStr]);

  // Filter tasks matching search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.priority.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // Tasks for currently selected calendar date
  const selectedDateTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.date === selectedDateStr);
  }, [filteredTasks, selectedDateStr]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentCalendarDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentCalendarDate(today);
    setSelectedDateStr(formatDateToISO(today));
  };

  // Date selection handler
  const handleSelectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const [y, m] = dateStr.split('-').map(Number);
    // If selecting a date in another month, update calendar viewport
    if (y !== currentCalendarDate.getFullYear() || m - 1 !== currentCalendarDate.getMonth()) {
      setCurrentCalendarDate(new Date(y, m - 1, 1));
    }
  };

  // Task creation/editing
  const handleOpenNewTaskModal = (dateStr?: string) => {
    setTaskToEdit(null);
    setModalInitialDate(dateStr || selectedDateStr);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setModalInitialDate(task.date);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (
    taskData: Omit<Task, 'id' | 'createdAt'>,
    existingTaskId?: string
  ) => {
    if (existingTaskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === existingTaskId ? { ...t, ...taskData } : t))
      );
    } else {
      const newTask: Task = {
        ...taskData,
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        focusSeconds: 0,
        isFocusRunning: false,
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Focus Session Handlers
  const handleToggleFocus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextRunning = !t.isFocusRunning;
          return {
            ...t,
            isFocusRunning: nextRunning,
            lastFocusStartedAt: nextRunning ? Date.now() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleStopAndLogFocus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            isFocusRunning: false,
            lastFocusStartedAt: undefined,
          };
        }
        return t;
      })
    );
  };

  const handleRestartFocus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            focusSeconds: 0,
            isFocusRunning: false,
            lastFocusStartedAt: undefined,
          };
        }
        return t;
      })
    );
  };

  // Task Completion Handler with Time Saved & Stats Trigger
  const handleToggleComplete = (taskId: string) => {
    let taskCompletedJustNow: Task | null = null;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextCompleted = !t.completed;
          const now = new Date();
          let savedMinutes: number | undefined = undefined;

          if (nextCompleted) {
            const timeSavedCalculation = calculateCompletionTimeSaved(t, now);
            savedMinutes = timeSavedCalculation.savedMinutes;
          }

          const updatedTask: Task = {
            ...t,
            completed: nextCompleted,
            isFocusRunning: false, // pause any active focus timer
            completedAt: nextCompleted ? now.toISOString() : undefined,
            timeSavedMinutes: nextCompleted ? savedMinutes : undefined,
          };

          if (nextCompleted) {
            taskCompletedJustNow = updatedTask;
          }

          return updatedTask;
        }
        return t;
      })
    );

    if (taskCompletedJustNow) {
      setCompletedTaskForModal(taskCompletedJustNow);
    }
  };

  const handleTogglePinCountdown = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        pinnedCountdown: t.id === taskId ? !t.pinnedCountdown : false,
      }))
    );
  };

  const handleToggleChecklistItem = (taskId: string, itemId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.checklist) {
          return {
            ...t,
            checklist: t.checklist.map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          };
        }
        return t;
      })
    );
  };

  const handleUpdateTaskTime = (taskId: string, extraMinutes: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const baseDate = new Date(`${t.date}T${t.time || '12:00'}`);
          baseDate.setMinutes(baseDate.getMinutes() + extraMinutes);
          const newTime = `${String(baseDate.getHours()).padStart(2, '0')}:${String(
            baseDate.getMinutes()
          ).padStart(2, '0')}`;
          return {
            ...t,
            time: newTime,
          };
        }
        return t;
      })
    );
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Sticky App Header */}
      <CalendarHeader
        currentDate={currentCalendarDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenNewTaskModal={() => handleOpenNewTaskModal(selectedDateStr)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalTaskCount={tasks.length}
        pendingTaskCount={pendingCount}
      />

      {/* Main Container with extra bottom padding for mobile navigation and FAB */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-12 space-y-5 sm:space-y-8 flex-1 overflow-x-hidden">
        {/* Mobile View Switcher (Screen < lg) */}
        <div className="lg:hidden flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileTab('calendar')}
            className={`flex-1 py-2 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileTab === 'calendar'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('countdowns')}
            className={`flex-1 py-2 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileTab === 'countdowns'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Countdowns</span>
            {tasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 text-zinc-700 font-bold ml-0.5">
                {tasks.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('both')}
            className={`flex-1 py-2 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileTab === 'both'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Both</span>
          </button>
        </div>

        {/* Content Layout: Calendar on the Left, All Countdowns on the Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: Calendar Grid */}
          <div
            className={`${
              mobileTab === 'countdowns' ? 'hidden lg:block' : 'block'
            } lg:col-span-7 xl:col-span-7 space-y-4 sm:space-y-6 w-full min-w-0`}
          >
            {viewMode === 'month' && (
              <MonthCalendar
                currentDate={currentCalendarDate}
                selectedDateStr={selectedDateStr}
                tasks={filteredTasks}
                onSelectDate={handleSelectDate}
                onQuickAddTask={(dateStr) => handleOpenNewTaskModal(dateStr)}
                onSelectTask={(task) => handleEditTask(task)}
              />
            )}

            {viewMode === 'week' && (
              <WeekCalendar
                selectedDate={selectedDateObj}
                selectedDateStr={selectedDateStr}
                tasks={filteredTasks}
                onSelectDate={handleSelectDate}
                onQuickAddTask={(dateStr) => handleOpenNewTaskModal(dateStr)}
                onSelectTask={(task) => handleEditTask(task)}
              />
            )}

            {viewMode === 'agenda' && (
              <AgendaView
                tasks={filteredTasks}
                onSelectTask={(task) => handleEditTask(task)}
                onToggleComplete={handleToggleComplete}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onSelectDate={(dateStr) => {
                  handleSelectDate(dateStr);
                  handleOpenNewTaskModal(dateStr);
                }}
              />
            )}

            {/* Mobile Selected Date Detail & Quick Add Strip */}
            <div className="lg:hidden bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block">
                    Selected Day
                  </span>
                  <span className="text-sm font-bold text-zinc-900">
                    {selectedDateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenNewTaskModal(selectedDateStr)}
                  className="px-3 py-1.5 min-h-[36px] text-xs font-bold bg-zinc-900 text-white rounded-xl flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>

              {selectedDateTasks.length > 0 ? (
                <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                  {selectedDateTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleEditTask(t)}
                      className="p-2 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-100/70"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(t.id);
                          }}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                            t.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-300 bg-white'
                          }`}
                        >
                          {t.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <span
                          className={`text-xs font-semibold truncate ${
                            t.completed ? 'line-through text-zinc-400' : 'text-zinc-800'
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileTab('countdowns');
                        }}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-800 shrink-0 flex items-center gap-0.5"
                      >
                        <span>Timer</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-400 pt-1">
                  No tasks scheduled for this day yet.
                </div>
              )}
            </div>

            {/* Quick Tips / Zen Mode Prompt Card */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
              <div className="flex items-center gap-2 font-bold text-zinc-800">
                <Clock className="w-3.5 h-3.5 text-zinc-700" />
                Real-time Precision Countdowns & Live Focus Tracking
              </div>
              <p className="leading-relaxed">
                Click <strong>▶ Start Focus</strong> on any countdown card to track your live session time, or click <strong>Zen</strong> for full-screen immersive focus with generative audio and milestones.
              </p>
            </div>
          </div>

          {/* Right Column: ONLY All Countdowns */}
          <div
            className={`${
              mobileTab === 'calendar' ? 'hidden lg:block' : 'block'
            } lg:col-span-5 xl:col-span-5 space-y-6 w-full min-w-0`}
          >
            <CountdownList
              tasks={filteredTasks}
              totalTasksCount={tasks.length}
              onAddNewTask={() => handleOpenNewTaskModal(selectedDateStr)}
              onSelectTask={(task) => handleEditTask(task)}
              onSelectDate={handleSelectDate}
              onToggleComplete={handleToggleComplete}
              onTogglePinCountdown={handleTogglePinCountdown}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onToggleChecklistItem={handleToggleChecklistItem}
              onOpenZenMode={(task) => setZenTask(task)}
              onToggleFocus={handleToggleFocus}
              onStopAndLogFocus={handleStopAndLogFocus}
              onRestartFocus={handleRestartFocus}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>
        </div>

        {/* Dedicated Productivity Analytics & Time Saved Bank Section */}
        <section className="pt-2">
          <ProductivityAnalytics tasks={tasks} />
        </section>
      </main>

      {/* Mobile Floating Action Button (FAB) for quick access */}
      <button
        type="button"
        onClick={() => handleOpenNewTaskModal(selectedDateStr)}
        className="fixed bottom-6 right-5 z-40 lg:hidden flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3.5 rounded-full shadow-2xl border border-zinc-700/60 active:scale-95 transition-all cursor-pointer group"
        aria-label="Add Task / Create Countdown"
        id="mobile-fab-add-task"
      >
        <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
        <span className="text-xs font-bold tracking-wide pr-1">Add Task</span>
      </button>

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSaveTask={handleSaveTask}
        initialDateStr={modalInitialDate}
        taskToEdit={taskToEdit}
      />

      {/* Task Completion Celebration Modal */}
      <TaskCompletionModal
        isOpen={!!completedTaskForModal}
        task={completedTaskForModal}
        onClose={() => setCompletedTaskForModal(null)}
      />

      {/* Zen Focus Mode Overlay */}
      {zenTask && (
        <ZenFocusOverlay
          task={tasks.find((t) => t.id === zenTask.id) || zenTask}
          onClose={() => setZenTask(null)}
          onToggleComplete={handleToggleComplete}
          onUpdateTaskTime={handleUpdateTaskTime}
        />
      )}
    </div>
  );
}
