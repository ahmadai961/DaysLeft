import React, { useState, useEffect } from 'react';
import { Task, TaskCategory, TaskPriority } from '../types';
import {
  Sparkles,
  X,
  Calendar as CalendarIcon,
  Clock,
  Check,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  Zap,
  Key,
  Info,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

// WARNING: Client-side Gemini API key usage requested by user.
// In-browser key access utilizes VITE_GEMINI_API_KEY or user-provided localStorage.

export interface GeneratedScheduleEvent {
  title: string;
  targetDate: string; // ISO 8601 string, e.g. "2026-10-15T18:00:00"
  durationMinutes: number;
  category: string;
  description?: string;
  priority?: string;
}

interface AutoSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptSchedule: (newTasks: Task[]) => void;
}

const SUGGESTED_CHIPS = [
  'Prep for exam next week with 3 study sessions',
  'Daily workout schedule for the next 5 days',
  'Launch project sprint with 3 milestone countdowns',
  'Review personal finances tomorrow at 6pm for 2 hours',
  '7-day morning mindfulness & reading routine',
];

/**
 * Retrieve Gemini API Key in the prioritized order requested:
 * 1. import.meta.env.VITE_GEMINI_API_KEY
 * 2. process.env.GEMINI_API_KEY
 * 3. localStorage.getItem('gemini_api_key')
 */
export function getGeminiApiKey(): string {
  // 1. import.meta.env.VITE_GEMINI_API_KEY
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_GEMINI_API_KEY) {
      const key = String(metaEnv.VITE_GEMINI_API_KEY).trim();
      if (key) return key;
    }
  } catch {
    // browser context fallback
  }

  // 2. process.env.GEMINI_API_KEY
  try {
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      const key = process.env.GEMINI_API_KEY.trim();
      if (key && key !== 'MY_GEMINI_API_KEY') return key;
    }
  } catch {
    // browser context fallback
  }

  // 3. localStorage.getItem('gemini_api_key')
  try {
    const key = localStorage.getItem('gemini_api_key');
    if (key && key.trim()) {
      return key.trim();
    }
  } catch {
    // localStorage inaccessible
  }

  return '';
}

// Helper to normalize category
function normalizeCategory(cat: string): TaskCategory {
  const c = cat.toLowerCase();
  if (c.includes('study') || c.includes('exam') || c.includes('learn') || c.includes('read')) {
    return 'Study';
  }
  if (
    c.includes('health') ||
    c.includes('workout') ||
    c.includes('fitness') ||
    c.includes('gym') ||
    c.includes('run') ||
    c.includes('exercise')
  ) {
    return 'Health';
  }
  if (c.includes('project') || c.includes('code') || c.includes('dev') || c.includes('sprint') || c.includes('build')) {
    return 'Project';
  }
  if (c.includes('work') || c.includes('client') || c.includes('job') || c.includes('meeting')) {
    return 'Work';
  }
  if (c.includes('finance') || c.includes('budget') || c.includes('tax') || c.includes('money')) {
    return 'Finance';
  }
  if (c.includes('personal') || c.includes('habit') || c.includes('home') || c.includes('mindful')) {
    return 'Personal';
  }
  return 'Other';
}

// Helper to normalize priority
function normalizePriority(pri?: string): TaskPriority {
  const p = pri?.toLowerCase() || '';
  if (p === 'urgent') return 'urgent';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

// Helper to format ISO date-time into readable strings
function formatTargetDateTime(targetDateStr: string): {
  dateFormatted: string;
  timeFormatted: string;
  relativeCountdown: string;
} {
  try {
    const d = new Date(targetDateStr);
    if (isNaN(d.getTime())) {
      return {
        dateFormatted: targetDateStr,
        timeFormatted: '',
        relativeCountdown: '',
      };
    }

    const dateFormatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    let relativeCountdown = '';

    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) {
        relativeCountdown = `in ${diffDays}d ${diffHours % 24}h`;
      } else if (diffHours > 0) {
        relativeCountdown = `in ${diffHours}h`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        relativeCountdown = `in ${Math.max(1, diffMins)}m`;
      }
    } else {
      relativeCountdown = 'Due today';
    }

    return { dateFormatted, timeFormatted, relativeCountdown };
  } catch {
    return {
      dateFormatted: targetDateStr,
      timeFormatted: '',
      relativeCountdown: '',
    };
  }
}

/**
 * Offline Smart Heuristic Parser
 * Automatically parses time, date, duration, and session count intents directly
 * in the browser so the user is NEVER blocked even when offline or without an API key.
 */
export function parseSmartHeuristicSchedule(prompt: string, referenceDate: Date = new Date()): GeneratedScheduleEvent[] {
  const text = prompt.toLowerCase();
  const currentYear = referenceDate.getFullYear();

  // 1. Detect category
  let category = 'other';
  if (/exam|study|quiz|test|revise|revision|class|lecture|read|learn|homework/.test(text)) {
    category = 'study';
  } else if (/workout|gym|run|fitness|exercise|leg day|push day|pull day|cardio|training/.test(text)) {
    category = 'health';
  } else if (/project|code|sprint|launch|build|feature|mvp|deploy|refactor|design/.test(text)) {
    category = 'project';
  } else if (/work|client|meeting|presentation|quarterly|sync|brief/.test(text)) {
    category = 'work';
  } else if (/finance|budget|tax|invoice|audit|money|expense|savings/.test(text)) {
    category = 'finance';
  } else if (/habit|routine|mindful|meditat|clean|organize|personal/.test(text)) {
    category = 'personal';
  }

  // 2. Detect duration in minutes
  let durationMinutes = 60;
  const hoursMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i);
  const minsMatch = prompt.match(/(\d+)\s*(?:minutes?|mins?|min|m)\b/i);

  if (hoursMatch) {
    durationMinutes = Math.round(parseFloat(hoursMatch[1]) * 60);
  } else if (minsMatch) {
    durationMinutes = parseInt(minsMatch[1], 10);
  } else if (category === 'health') {
    durationMinutes = 45;
  } else if (category === 'project') {
    durationMinutes = 90;
  }

  // 3. Detect time of day (hour & minute)
  let targetHour = 18; // Default to 6:00 PM
  let targetMinute = 0;

  const timeMatch = prompt.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const isPm = timeMatch[3].toLowerCase() === 'pm';
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    targetHour = hour;
    targetMinute = minute;
  } else if (/morning\b/i.test(prompt)) {
    targetHour = 9;
  } else if (/afternoon\b/i.test(prompt)) {
    targetHour = 14;
  } else if (/evening\b/i.test(prompt)) {
    targetHour = 18;
  } else if (/night\b/i.test(prompt)) {
    targetHour = 20;
  } else if (/noon\b/i.test(prompt)) {
    targetHour = 12;
  }

  // 4. Detect target base date
  let targetDateObj = new Date(referenceDate);
  let explicitTargetFound = false;

  // Month Names: e.g. "Oct 20", "October 20th", "Nov 5"
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthRegex = new RegExp(`(${monthNames.join('|')})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
  const monthMatch = prompt.match(monthRegex);

  if (monthMatch) {
    const monthIndex = monthNames.findIndex((m) => monthMatch[1].toLowerCase().startsWith(m));
    const dayNumber = parseInt(monthMatch[2], 10);
    if (monthIndex !== -1 && dayNumber >= 1 && dayNumber <= 31) {
      targetDateObj = new Date(currentYear, monthIndex, dayNumber, targetHour, targetMinute, 0);
      if (targetDateObj.getTime() < referenceDate.getTime()) {
        targetDateObj.setFullYear(currentYear + 1);
      }
      explicitTargetFound = true;
    }
  } else if (/\btomorrow\b/i.test(prompt)) {
    targetDateObj = new Date(referenceDate);
    targetDateObj.setDate(targetDateObj.getDate() + 1);
    targetDateObj.setHours(targetHour, targetMinute, 0, 0);
    explicitTargetFound = true;
  } else if (/in\s+(\d+)\s+days?\b/i.test(prompt)) {
    const inDays = parseInt(prompt.match(/in\s+(\d+)\s+days?\b/i)![1], 10);
    targetDateObj = new Date(referenceDate);
    targetDateObj.setDate(targetDateObj.getDate() + inDays);
    targetDateObj.setHours(targetHour, targetMinute, 0, 0);
    explicitTargetFound = true;
  } else if (/next\s+week\b/i.test(prompt)) {
    targetDateObj = new Date(referenceDate);
    targetDateObj.setDate(targetDateObj.getDate() + 7);
    targetDateObj.setHours(targetHour, targetMinute, 0, 0);
    explicitTargetFound = true;
  } else {
    // Check for days of week: "on Friday", "next Tuesday"
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = prompt.match(/(?:next|on|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDayIndex = daysOfWeek.indexOf(dayMatch[1].toLowerCase());
      if (targetDayIndex !== -1) {
        const currentDayIndex = referenceDate.getDay();
        let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // Next occurrence
        targetDateObj = new Date(referenceDate);
        targetDateObj.setDate(targetDateObj.getDate() + daysToAdd);
        targetDateObj.setHours(targetHour, targetMinute, 0, 0);
        explicitTargetFound = true;
      }
    }
  }

  // 5. Detect number of sessions
  let sessionCount = 1;
  const countMatch = prompt.match(/(\d+)\s*(?:study\s*)?(?:sessions?|parts?|blocks?|days?|workouts?|sprints?|milestones?)/i);
  if (countMatch) {
    sessionCount = Math.min(7, Math.max(1, parseInt(countMatch[1], 10)));
  } else if (/break\s*down|schedule|routine|sprint|curriculum/i.test(prompt)) {
    sessionCount = 3;
  }

  // Helper to format ISO local string
  const formatIso = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  };

  // Clean prompt for task subject
  const cleanedPrompt = prompt
    .replace(/^(prep for|prepare for|i have an|i have a|break down a|schedule a|daily|please schedule)\s*/i, '')
    .replace(/\bwith \d+ (?:study )?sessions?\b/i, '')
    .replace(/\bfor the next \d+ days?\b/i, '')
    .replace(/\btomorrow\b/i, '')
    .replace(/\bat \d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, '')
    .replace(/\bfor \d+\s*(?:hours?|minutes?|hrs?|mins?)\b/i, '')
    .trim();

  const baseTitle = cleanedPrompt.length > 2
    ? cleanedPrompt.charAt(0).toUpperCase() + cleanedPrompt.slice(1)
    : prompt.trim();

  // If a single session was parsed
  if (sessionCount === 1) {
    if (!explicitTargetFound) {
      targetDateObj.setDate(targetDateObj.getDate() + 1);
      targetDateObj.setHours(targetHour, targetMinute, 0, 0);
    }
    return [
      {
        title: baseTitle,
        targetDate: formatIso(targetDateObj),
        durationMinutes,
        category,
        description: `Dedicated ${durationMinutes}m session for: ${baseTitle}`,
        priority: 'high',
      },
    ];
  }

  // If multiple sessions: space them leading up to the target date or across consecutive days
  const events: GeneratedScheduleEvent[] = [];
  const totalDaysSpan = explicitTargetFound
    ? Math.max(1, Math.round((targetDateObj.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)))
    : sessionCount * 2;

  const dayInterval = Math.max(1, Math.floor(totalDaysSpan / sessionCount));

  for (let i = 0; i < sessionCount; i++) {
    const sessionDate = new Date(referenceDate);
    // If explicit target is set, pace sessions leading up to the target
    if (explicitTargetFound && totalDaysSpan > sessionCount) {
      const offsetDays = Math.max(1, Math.round(((i + 1) * totalDaysSpan) / sessionCount));
      sessionDate.setDate(referenceDate.getDate() + offsetDays);
    } else {
      sessionDate.setDate(referenceDate.getDate() + (i + 1) * dayInterval);
    }
    sessionDate.setHours(targetHour, targetMinute, 0, 0);

    let stageTitle = `Session ${i + 1}`;
    let stageDesc = `Focused block ${i + 1} of ${sessionCount}`;

    if (category === 'study') {
      const studyStages = [
        'Core Fundamentals & Concept Mapping',
        'Deep Practice & Problem Sets',
        'Mock Exam Sprint & Final Review',
        'Consolidation & Weak Point Revision',
        'Final Walkthrough & Formula Recall',
      ];
      stageTitle = studyStages[i % studyStages.length];
      stageDesc = `Study block for ${baseTitle}: ${stageTitle}`;
    } else if (category === 'health') {
      const workoutStages = [
        'Upper Body Strength & Core',
        'Lower Body Power & Mobility',
        'Conditioning & Interval Cardio',
        'Active Recovery & Flex Stretch',
        'Full Body Peak Performance',
      ];
      stageTitle = workoutStages[i % workoutStages.length];
      stageDesc = `Workout block: ${stageTitle}`;
    } else if (category === 'project') {
      const projectStages = [
        'Architecture & Core Implementation',
        'Feature Integration & Component Logic',
        'Polish, Testing & Launch Sprint',
        'Optimization & Bug Fixes',
      ];
      stageTitle = projectStages[i % projectStages.length];
      stageDesc = `Project milestone: ${stageTitle}`;
    }

    events.push({
      title: `${baseTitle}: ${stageTitle}`,
      targetDate: formatIso(sessionDate),
      durationMinutes,
      category,
      description: stageDesc,
      priority: i === sessionCount - 1 ? 'urgent' : i === 0 ? 'medium' : 'high',
    });
  }

  return events;
}

export const AutoSchedulerModal: React.FC<AutoSchedulerModalProps> = ({
  isOpen,
  onClose,
  onAcceptSchedule,
}) => {
  const [goalPrompt, setGoalPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedEvents, setGeneratedEvents] = useState<GeneratedScheduleEvent[]>([]);
  const [selectedEventIndices, setSelectedEventIndices] = useState<Set<number>>(new Set());

  // API Key management
  const [currentApiKey, setCurrentApiKey] = useState<string>(() => getGeminiApiKey());
  const [keyInputValue, setKeyInputValue] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [keySaveSuccess, setKeySaveSuccess] = useState<boolean>(false);
  const [activeSource, setActiveSource] = useState<'gemini' | 'heuristic' | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Sync key when modal opens
  useEffect(() => {
    if (isOpen) {
      const key = getGeminiApiKey();
      setCurrentApiKey(key);
      if (!key) {
        setShowKeyInput(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveApiKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = keyInputValue.trim();
    if (!cleanKey) return;

    try {
      localStorage.setItem('gemini_api_key', cleanKey);
      setCurrentApiKey(cleanKey);
      setKeySaveSuccess(true);
      setKeyInputValue('');
      setTimeout(() => setKeySaveSuccess(false), 3000);
      setInfoMessage('API key saved to browser storage. Ready for direct Gemini generation!');
    } catch (err) {
      console.warn('Failed to save API key to localStorage', err);
    }
  };

  const handleClearApiKey = () => {
    try {
      localStorage.removeItem('gemini_api_key');
      setCurrentApiKey('');
      setShowKeyInput(true);
      setInfoMessage('API key removed from browser storage.');
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!goalPrompt.trim() || isLoading) return;

    setIsLoading(true);
    setInfoMessage(null);
    setGeneratedEvents([]);

    const todayDateIso = new Date().toISOString();
    const apiKey = currentApiKey || getGeminiApiKey();

    // If no API key is available, seamlessly use the smart heuristic engine
    if (!apiKey) {
      const heuristicResults = parseSmartHeuristicSchedule(goalPrompt.trim(), new Date());
      setGeneratedEvents(heuristicResults);
      setSelectedEventIndices(new Set(heuristicResults.map((_, i) => i)));
      setActiveSource('heuristic');
      setShowKeyInput(true);
      setInfoMessage(
        'Generated using the browser offline heuristic parser. Enter a Gemini API Key below for generative AI pacing.'
      );
      setIsLoading(false);
      return;
    }

    // Direct Gemini Browser API Call (no backend routes used)
    try {
      const systemInstructionText = `You are an expert AI Scheduling Assistant.
The current reference date and time is: ${todayDateIso}.
Break down the user's goal into an array of 2 to 6 concrete, sequential countdown sessions leading up to the target.
Rules:
1. Every targetDate MUST be an ISO 8601 string: 'YYYY-MM-DDTHH:mm:00'. Ensure dates are in the future relative to ${todayDateIso}.
2. durationMinutes must be a number (e.g., 30, 45, 60, 90, 120).
3. category must be one of: 'study', 'health', 'work', 'project', 'finance', 'personal', 'other'.
4. priority must be: 'low', 'medium', 'high', or 'urgent'.
5. Return ONLY a valid JSON array of session objects.`;

      const promptPayload = {
        contents: [
          {
            parts: [
              {
                text: `${systemInstructionText}\n\nUser Goal: "${goalPrompt.trim()}"`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      };

      const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(directUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptPayload),
      });

      if (!response.ok) {
        // If API key is invalid or request fails, do not throw a red error screen.
        // Prompt for key input and run heuristic fallback immediately so user is never blocked!
        const errJson = await response.json().catch(() => ({}));
        console.warn('Gemini API call returned non-200:', response.status, errJson);

        setShowKeyInput(true);
        const fallbackResults = parseSmartHeuristicSchedule(goalPrompt.trim(), new Date());
        setGeneratedEvents(fallbackResults);
        setSelectedEventIndices(new Set(fallbackResults.map((_, i) => i)));
        setActiveSource('heuristic');
        setInfoMessage(
          `Gemini responded with status ${response.status}. Generated via Smart Heuristic Engine so you can proceed without interruption.`
        );
        return;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      let parsedEvents: GeneratedScheduleEvent[] = [];
      try {
        parsedEvents = JSON.parse(cleanJson);
      } catch {
        parsedEvents = [];
      }

      if (Array.isArray(parsedEvents) && parsedEvents.length > 0) {
        setGeneratedEvents(parsedEvents);
        setSelectedEventIndices(new Set(parsedEvents.map((_, i) => i)));
        setActiveSource('gemini');
      } else {
        // Fallback to heuristic parser if model returned unexpected format
        const fallbackResults = parseSmartHeuristicSchedule(goalPrompt.trim(), new Date());
        setGeneratedEvents(fallbackResults);
        setSelectedEventIndices(new Set(fallbackResults.map((_, i) => i)));
        setActiveSource('heuristic');
      }
    } catch (netErr: any) {
      console.warn('Direct Gemini call failed or offline:', netErr);
      // Offline fallback
      const fallbackResults = parseSmartHeuristicSchedule(goalPrompt.trim(), new Date());
      setGeneratedEvents(fallbackResults);
      setSelectedEventIndices(new Set(fallbackResults.map((_, i) => i)));
      setActiveSource('heuristic');
      setInfoMessage(
        'Offline or network limitation detected. Created using offline smart heuristics.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (chip: string) => {
    setGoalPrompt(chip);
  };

  const handleToggleEventSelect = (index: number) => {
    setSelectedEventIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAccept = () => {
    const selectedEvents = generatedEvents.filter((_, idx) =>
      selectedEventIndices.has(idx)
    );

    if (selectedEvents.length === 0) return;

    // Convert GeneratedScheduleEvent to Task objects
    const nowIso = new Date().toISOString();
    const createdTasks: Task[] = selectedEvents.map((evt, idx) => {
      let datePart = '';
      let timePart = '18:00';

      if (evt.targetDate && evt.targetDate.includes('T')) {
        const parts = evt.targetDate.split('T');
        datePart = parts[0];
        timePart = parts[1].substring(0, 5);
      } else {
        datePart = evt.targetDate || '';
      }

      if (!datePart || !datePart.includes('-')) {
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + idx + 1);
        datePart = fallbackDate.toISOString().split('T')[0];
      }

      const category = normalizeCategory(evt.category);
      const priority = normalizePriority(evt.priority);
      const duration = evt.durationMinutes || 60;

      const subtask1Time = Math.max(5, Math.round(duration * 0.15));
      const subtask2Time = Math.max(15, Math.round(duration * 0.7));
      const subtask3Time = Math.max(5, Math.round(duration * 0.15));

      return {
        id: `task-ai-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: evt.title,
        description:
          evt.description ||
          `AI scheduled session: ${duration} minutes planned for ${evt.title}.`,
        date: datePart,
        time: timePart,
        isAllDay: false,
        priority,
        category,
        completed: false,
        createdAt: nowIso,
        pinnedCountdown: idx === 0,
        focusSeconds: 0,
        isFocusRunning: false,
        checklist: [
          {
            id: `chk-${Date.now()}-${idx}-1`,
            text: `Setup workspace & clarify key concepts (~${subtask1Time}m)`,
            done: false,
          },
          {
            id: `chk-${Date.now()}-${idx}-2`,
            text: `Focused execution block & problem sets (~${subtask2Time}m)`,
            done: false,
          },
          {
            id: `chk-${Date.now()}-${idx}-3`,
            text: `Review progress, log findings & summarize (~${subtask3Time}m)`,
            done: false,
          },
        ],
      };
    });

    onAcceptSchedule(createdTasks);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#34d399', '#f59e0b'],
      });
    } catch {
      // Confetti fallback
    }

    onClose();
  };

  const handleReset = () => {
    setGeneratedEvents([]);
    setSelectedEventIndices(new Set());
    setActiveSource(null);
    setInfoMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-zinc-900 border border-zinc-800/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-50"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  AI Auto-Scheduler
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  Client-Side Engine
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Direct browser AI decomposition & smart offline heuristics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 rounded-lg flex items-center gap-1 border border-zinc-700/60 cursor-pointer"
              title="Configure API Key"
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{currentApiKey ? 'Key Active' : 'Set Key'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* IN-APP KEY SETUP CARD (If requested, missing, or toggled) */}
          {showKeyInput && (
            <div className="p-3.5 bg-zinc-800 border border-zinc-800 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gemini API Key Configuration</span>
                </div>
                {currentApiKey && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-[10px] text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Remove Saved Key
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveApiKey} className="flex gap-2">
                <input
                  type="password"
                  value={keyInputValue}
                  onChange={(e) => setKeyInputValue(e.target.value)}
                  placeholder={currentApiKey ? '•••••••••••••••• (Key saved in localStorage)' : 'Enter your Gemini API Key (e.g. AIza...)'}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40 shadow-2xs font-mono"
                />
                <button
                  type="submit"
                  disabled={!keyInputValue.trim()}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    keyInputValue.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-zinc-600 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Save
                </button>
              </form>

              {keySaveSuccess && (
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Key successfully saved into localStorage!
                </p>
              )}

              <p className="text-[11px] text-zinc-400 leading-normal">
                Stored in browser <code className="bg-zinc-600/70 px-1 py-0.5 rounded text-[10px]">localStorage.getItem('gemini_api_key')</code>. Direct requests are sent straight from your browser to Google Gen AI without backend server routes.
              </p>
            </div>
          )}

          {/* Informational Message Banner */}
          {infoMessage && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <p className="text-[11px] leading-relaxed">{infoMessage}</p>
            </div>
          )}

          {/* STEP 1: Prompt Input & Suggested Chips (if not previewing) */}
          {generatedEvents.length === 0 ? (
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  What is your upcoming goal or target?
                </label>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={goalPrompt}
                    onChange={(e) => setGoalPrompt(e.target.value)}
                    placeholder="e.g., I have an exam on Oct 20, break down a study schedule for me with 3 study sessions..."
                    className="w-full bg-zinc-800 focus:bg-zinc-900 text-zinc-50 placeholder-zinc-400 border border-zinc-700 focus:border-blue-500 rounded-xl p-3.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all leading-relaxed resize-none shadow-2xs"
                    disabled={isLoading}
                    autoFocus
                  />
                  {goalPrompt && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setGoalPrompt('')}
                      className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-400 text-xs font-bold p-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Suggested Chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Suggested Prompts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_CHIPS.map((chip, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        disabled={isLoading}
                        className="text-[11px] text-zinc-400 hover:text-zinc-50 bg-zinc-700 hover:bg-zinc-600/80 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer text-left active:scale-98"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!goalPrompt.trim() || isLoading}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                      !goalPrompt.trim() || isLoading
                        ? 'bg-zinc-600 text-zinc-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Formulating Schedule...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                        <span>Generate Schedule</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Informative Helper Callout */}
              <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-300 flex items-start gap-2.5">
                <CalendarIcon className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-sky-300">
                  <strong className="font-semibold text-sky-300">Direct Client Intelligence: </strong>
                  Calls Google Gen AI directly from your browser. Includes an offline intent parser that converts dates (e.g. "tomorrow", "Oct 20"), times ("6pm"), and durations ("2 hours") without requiring backend server routes.
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview Generated Sessions */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Preview Header Banner */}
              <div className="flex items-center justify-between bg-zinc-800 border border-zinc-800/90 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-zinc-50">
                        Formulated {generatedEvents.length} countdown sessions:
                      </h3>
                      {activeSource === 'gemini' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          ⚡ Direct Gemini AI
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          ✨ Smart Heuristic Parser
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {selectedEventIndices.size} of {generatedEvents.length} selected to add
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center gap-1 p-1 rounded hover:bg-zinc-700 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Try another</span>
                </button>
              </div>

              {/* Event Cards List */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {generatedEvents.map((evt, idx) => {
                  const isSelected = selectedEventIndices.has(idx);
                  const { dateFormatted, timeFormatted, relativeCountdown } =
                    formatTargetDateTime(evt.targetDate);
                  const category = normalizeCategory(evt.category);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleEventSelect(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isSelected
                          ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                          : 'bg-zinc-800/80 border-zinc-800 text-zinc-500 opacity-60'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-zinc-700 bg-zinc-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isSelected ? 'text-zinc-50' : 'text-zinc-400'
                            }`}
                          >
                            {evt.title}
                          </h4>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Category Pill */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 border border-zinc-800">
                              {category}
                            </span>

                            {/* Duration Badge */}
                            <span className="text-[10px] font-semibold text-zinc-400 flex items-center gap-0.5 font-mono">
                              <Clock className="w-2.5 h-2.5" />
                              {evt.durationMinutes}m
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        {evt.description && (
                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                            {evt.description}
                          </p>
                        )}

                        {/* Date & Countdown Info */}
                        <div className="pt-1 flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-zinc-200">
                            <CalendarIcon className="w-3 h-3 text-zinc-500" />
                            {dateFormatted} {timeFormatted && `• ${timeFormatted}`}
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/30 text-[10px]">
                            ⏳ {relativeCountdown}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: [Accept] [Cancel] */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={selectedEventIndices.size === 0}
                    className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      selectedEventIndices.size === 0
                        ? 'bg-zinc-600 text-zinc-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Accept {selectedEventIndices.size > 0 ? `(${selectedEventIndices.size})` : ''} & Add to Calendar
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
