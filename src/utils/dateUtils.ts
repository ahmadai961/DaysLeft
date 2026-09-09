import { Task, CountdownState } from '../types';

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date string (YYYY-MM-DD) to friendly readable format
 */
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format full long date: "Monday, August 31, 2026"
 */
export function formatLongDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format 24h time "14:30" to "2:30 PM"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return 'All Day';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get the target Date object for a task (date + time)
 */
export function getTaskTargetDate(task: Task): Date {
  const [year, month, day] = task.date.split('-').map(Number);
  let hours = 23;
  let minutes = 59;
  let seconds = 59;

  if (task.time && !task.isAllDay) {
    const [h, m] = task.time.split(':').map(Number);
    hours = isNaN(h) ? 23 : h;
    minutes = isNaN(m) ? 59 : m;
    seconds = 0;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Calculate countdown information for a task relative to now
 */
export function calculateTaskCountdown(task: Task, now: Date = new Date()): CountdownState {
  const targetDate = getTaskTargetDate(task);
  const diffMs = targetDate.getTime() - now.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const isOverdue = totalSeconds < 0 && !task.completed;
  const isDueNow = Math.abs(totalSeconds) <= 60 && !task.completed;

  // Calculate created timestamp or fallback
  const createdDate = task.createdAt ? new Date(task.createdAt) : new Date(now.getTime() - 24 * 3600 * 1000);
  const totalDurationMs = Math.max(1000, targetDate.getTime() - createdDate.getTime());
  const elapsedMs = now.getTime() - createdDate.getTime();
  let progress = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));
  if (task.completed) progress = 100;

  const absSeconds = Math.abs(totalSeconds);
  const days = Math.floor(absSeconds / (24 * 3600));
  const hours = Math.floor((absSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const todayStr = formatDateToISO(now);
  const isToday = task.date === todayStr;

  let formattedString = '';
  if (task.completed) {
    formattedString = 'Completed';
  } else if (isOverdue) {
    if (days > 0) formattedString = `Overdue by ${days}d ${hours}h`;
    else if (hours > 0) formattedString = `Overdue by ${hours}h ${minutes}m`;
    else formattedString = `Overdue by ${minutes}m ${seconds}s`;
  } else {
    if (days > 0) formattedString = `${days}d ${hours}h ${minutes}m left`;
    else if (hours > 0) formattedString = `${hours}h ${minutes}m ${seconds}s left`;
    else formattedString = `${minutes}m ${seconds}s left`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isOverdue,
    isToday,
    isDueNow,
    totalSecondsRemaining: totalSeconds,
    formattedString,
    progress,
  };
}

export interface TaskColorOption {
  name: string;
  hex: string;
}

export const PRESET_TASK_COLORS: TaskColorOption[] = [
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Lime', hex: '#65a30d' },
];

/**
 * Get a random color hex from the curated palette
 */
export function getRandomColor(): string {
  const index = Math.floor(Math.random() * PRESET_TASK_COLORS.length);
  return PRESET_TASK_COLORS[index].hex;
}

/**
 * Get the color for a task (returns custom color or a stable random color based on task ID)
 */
export function getTaskColor(task: Task): string {
  if (task.color && task.color.trim()) {
    return task.color;
  }
  // Deterministic stable fallback based on task ID if no color explicitly assigned
  if (!task.id) return PRESET_TASK_COLORS[0].hex;
  let hash = 0;
  for (let i = 0; i < task.id.length; i++) {
    hash = (hash << 5) - hash + task.id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PRESET_TASK_COLORS.length;
  return PRESET_TASK_COLORS[idx].hex;
}

/**
 * Calendar month matrix helper
 */
export interface CalendarDay {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  tasks: Task[];
}

export function getMonthDays(
  year: number,
  month: number, // 0-indexed (0 = Jan, 7 = Aug)
  selectedDateStr: string,
  tasks: Task[]
): CalendarDay[] {
  const todayStr = formatDateToISO(new Date());
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = lastDayOfMonth.getDate();

  const days: CalendarDay[] = [];

  // Group tasks by date for fast lookup
  const taskMap = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = taskMap.get(t.date) || [];
    list.push(t);
    taskMap.set(t.date, list);
  }

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const d = new Date(year, month - 1, dayNum);
    const dateStr = formatDateToISO(d);
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDateStr,
      tasks: taskMap.get(dateStr) || [],
    });
  }

  // Current month days
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const d = new Date(year, month, dayNum);
    const dateStr = formatDateToISO(d);
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDateStr,
      tasks: taskMap.get(dateStr) || [],
    });
  }

  // Next month padding to fill grid (35 or 42 cells)
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i);
    const dateStr = formatDateToISO(d);
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDateStr,
      tasks: taskMap.get(dateStr) || [],
    });
  }

  return days;
}

/**
 * Get week days starting from the Sunday or Monday containing target date
 */
export function getWeekDays(
  targetDate: Date,
  selectedDateStr: string,
  tasks: Task[]
): CalendarDay[] {
  const todayStr = formatDateToISO(new Date());
  const currentDayOfWeek = targetDate.getDay();
  const startOfWeek = new Date(targetDate);
  startOfWeek.setDate(targetDate.getDate() - currentDayOfWeek);

  const taskMap = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = taskMap.get(t.date) || [];
    list.push(t);
    taskMap.set(t.date, list);
  }

  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDateToISO(d);
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth: d.getMonth() === targetDate.getMonth(),
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDateStr,
      tasks: taskMap.get(dateStr) || [],
    });
  }
  return days;
}

/**
 * Format seconds to standard HH:MM:SS for active focus counter
 */
export function formatSecondsToHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format seconds to concise readable duration (e.g. "1h 25m" or "42m 10s" or "15s")
 */
export function formatSecondsToFriendly(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return '0m';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  if (mins > 0) {
    return secs > 0 && mins < 5 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
}

/**
 * Format minutes to clean readable string (e.g. "2h 45m" or "35m")
 */
export function formatMinutesToFriendly(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m === 0) return '0m';
  const days = Math.floor(m / (60 * 24));
  const hrs = Math.floor((m % (60 * 24)) / 60);
  const mins = m % 60;

  if (days > 0) {
    return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  }
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

/**
 * Calculate the difference between completion timestamp and task target deadline
 */
export function calculateCompletionTimeSaved(task: Task, completionDate: Date = new Date()): {
  isEarly: boolean;
  savedMinutes: number;
  formattedSaved: string;
} {
  const targetDate = getTaskTargetDate(task);
  const diffMs = targetDate.getTime() - completionDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes > 0) {
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const mins = diffMinutes % 60;

    let formatted = '';
    if (days > 0) {
      formatted = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    } else if (hours > 0) {
      formatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
      formatted = `${mins}m`;
    }

    return {
      isEarly: true,
      savedMinutes: diffMinutes,
      formattedSaved: `+${formatted} Time Saved`,
    };
  }

  return {
    isEarly: false,
    savedMinutes: 0,
    formattedSaved: 'Completed Overdue',
  };
}

