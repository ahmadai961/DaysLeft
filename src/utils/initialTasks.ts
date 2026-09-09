import { Task } from '../types';
import { formatDateToISO } from './dateUtils';

export function getInitialTasks(): Task[] {
  const now = new Date();
  
  // Today ISO
  const todayStr = formatDateToISO(now);
  
  // Tomorrow ISO
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatDateToISO(tomorrow);

  // In 3 days
  const in3Days = new Date(now);
  in3Days.setDate(now.getDate() + 3);
  const in3DaysStr = formatDateToISO(in3Days);

  // In 5 days
  const in5Days = new Date(now);
  in5Days.setDate(now.getDate() + 5);
  const in5DaysStr = formatDateToISO(in5Days);

  return [
    {
      id: 'task-1',
      title: 'Complete Project Presentation Slides',
      description: 'Review architecture diagrams, finalize metrics deck, and polish delivery notes.',
      date: todayStr,
      time: '18:00',
      isAllDay: false,
      priority: 'high',
      category: 'Work',
      color: '#3b82f6',
      completed: false,
      focusSeconds: 2400, // 40 mins logged
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      pinnedCountdown: true,
      checklist: [
        { id: 'c1', text: 'Executive summary slide', done: true },
        { id: 'c2', text: 'System design benchmark graphs', done: false },
        { id: 'c3', text: 'Dry run rehearsal', done: false },
      ],
    },
    {
      id: 'task-2',
      title: 'Deep Learning & Algorithms Research',
      description: 'Go over transformer attention benchmarks and chapter notes.',
      date: tomorrowStr,
      time: '10:30',
      isAllDay: false,
      priority: 'medium',
      category: 'Study',
      color: '#6366f1',
      completed: false,
      focusSeconds: 3900, // 1h 05m logged
      createdAt: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
      checklist: [
        { id: 'c4', text: 'Review multi-head attention derivation', done: true },
        { id: 'c5', text: 'Implement PyTorch test script', done: false },
      ],
    },
    {
      id: 'task-3',
      title: 'Quarterly Financial Planning & Review',
      description: 'Audit monthly recurring subscriptions and allocate budget for Q4 initiatives.',
      date: in3DaysStr,
      time: '15:00',
      isAllDay: false,
      priority: 'urgent',
      category: 'Finance',
      color: '#ef4444',
      completed: false,
      focusSeconds: 1200,
      createdAt: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
    },
    {
      id: 'task-4',
      title: 'Wellness: 5km Cardio Run & Mobility',
      description: 'Stay active, hit target heart rate zone, and do 15 min deep stretching.',
      date: in5DaysStr,
      time: '08:00',
      isAllDay: false,
      priority: 'low',
      category: 'Health',
      color: '#10b981',
      completed: false,
      focusSeconds: 2700, // 45m logged
      createdAt: new Date(now.getTime() - 12 * 3600 * 1000).toISOString(),
    },
  ];
}

const STORAGE_KEY = 'task_calendar_white_tasks_v1';

export function loadTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tasks from localStorage', e);
  }
  const defaults = getInitialTasks();
  saveTasksToStorage(defaults);
  return defaults;
}

export function saveTasksToStorage(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}
