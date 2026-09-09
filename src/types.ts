export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskCategory = 'Work' | 'Personal' | 'Study' | 'Health' | 'Finance' | 'Project' | 'Other';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or "" for all-day
  isAllDay: boolean;
  priority: TaskPriority;
  category: TaskCategory;
  color?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  pinnedCountdown?: boolean;
  checklist?: ChecklistItem[];
  focusSeconds?: number; // Total accumulated focus time in seconds
  isFocusRunning?: boolean; // Whether count-up focus timer is currently active
  lastFocusStartedAt?: number; // Timestamp when current focus session started
  timeSavedMinutes?: number; // Minutes saved by completing early before deadline
}

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOverdue: boolean;
  isToday: boolean;
  isDueNow: boolean;
  totalSecondsRemaining: number;
  formattedString: string;
  progress: number; // 0 to 100
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
export type FilterTab = 'all' | 'upcoming' | 'today' | 'overdue' | 'completed';
