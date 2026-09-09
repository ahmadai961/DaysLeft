import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task } from '../types';
import { calculateTaskCountdown } from '../utils/dateUtils';
import { ambientSound, AmbientSoundType } from '../utils/ambientAudio';
import {
  X,
  Play,
  Pause,
  Plus,
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Headphones,
  Check,
  Flame,
  Clock,
  Waves,
  Coffee,
  CloudRain,
  Radio,
  Sliders,
  Music,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ZenFocusOverlayProps {
  task: Task;
  onClose: () => void;
  onToggleComplete: (taskId: string) => void;
  onUpdateTaskTime?: (taskId: string, extraMinutes: number) => void;
}

interface Milestone {
  id: string;
  text: string;
  estimatedMins?: number;
  done: boolean;
}

export const ZenFocusOverlay: React.FC<ZenFocusOverlayProps> = ({
  task,
  onClose,
  onToggleComplete,
  onUpdateTaskTime,
}) => {
  // Timer State
  const initialCountdown = useMemo(() => calculateTaskCountdown(task), [task]);
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.max(1, initialCountdown.totalSecondsRemaining || 25 * 60)
  );
  const [initialTotalSeconds, setInitialTotalSeconds] = useState<number>(() =>
    Math.max(secondsLeft, 25 * 60)
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Audio State
  const [activeSound, setActiveSound] = useState<AmbientSoundType>('none');
  const [soundVolume, setSoundVolume] = useState<number>(0.5);

  // AI Milestones Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState<boolean>(false);
  const [milestoneInput, setMilestoneInput] = useState<string>('');

  // Pulse animation tick
  const [pulsePhase, setPulsePhase] = useState<number>(0);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Real-time Countdown interval
  useEffect(() => {
    if (isPaused || task.completed) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
      setPulsePhase((p) => (p + 1) % 60);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, task.completed]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      ambientSound.stop();
    };
  }, []);

  // Fetch AI milestones on mount or when task changes
  useEffect(() => {
    let isMounted = true;
    async function fetchAiMilestones() {
      // If task already has checklist items, initialize from them
      if (task.checklist && task.checklist.length > 0) {
        setMilestones(
          task.checklist.map((item) => ({
            id: item.id,
            text: item.text,
            done: item.done,
            estimatedMins: 5,
          }))
        );
        return;
      }

      setIsLoadingMilestones(true);
      try {
        const estMins = Math.round(secondsLeft / 60) || 25;
        const res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: task.title,
            category: task.category,
            description: task.description,
            remainingMinutes: estMins,
          }),
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (isMounted && data.milestones && Array.isArray(data.milestones)) {
          setMilestones(
            data.milestones.map((m: any, idx: number) => ({
              id: `m-${Date.now()}-${idx}`,
              text: m.text || 'Focus Milestone',
              estimatedMins: m.estimatedMins || 10,
              done: false,
            }))
          );
        }
      } catch (err) {
        if (isMounted) {
          setMilestones([
            { id: 'm-1', text: `Set up environment & key objectives`, done: false, estimatedMins: 5 },
            { id: 'm-2', text: `Execute core phase of ${task.title}`, done: false, estimatedMins: 15 },
            { id: 'm-3', text: `Review deliverables & final wrap up`, done: false, estimatedMins: 5 },
          ]);
        }
      } finally {
        if (isMounted) setIsLoadingMilestones(false);
      }
    }

    fetchAiMilestones();
    return () => {
      isMounted = false;
    };
  }, [task.id, task.title]);

  // Audio Toggles
  const handleSoundSelect = (type: AmbientSoundType) => {
    if (activeSound === type) {
      ambientSound.stop();
      setActiveSound('none');
    } else {
      ambientSound.play(type);
      ambientSound.setVolume(soundVolume);
      setActiveSound(type);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSoundVolume(val);
    ambientSound.setVolume(val);
  };

  // Add Minutes
  const handleAddMinutes = (mins: number) => {
    setSecondsLeft((s) => s + mins * 60);
    setInitialTotalSeconds((tot) => tot + mins * 60);
    if (onUpdateTaskTime) {
      onUpdateTaskTime(task.id, mins);
    }
  };

  // Toggle milestone completion with micro-confetti
  const handleToggleMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextDone = !m.done;
          if (nextDone) {
            confetti({
              particleCount: 25,
              spread: 40,
              origin: { y: 0.7 },
              colors: ['#38bdf8', '#818cf8', '#34d399'],
            });
          }
          return { ...m, done: nextDone };
        }
        return m;
      })
    );
  };

  // Add custom milestone
  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneInput.trim()) return;
    setMilestones((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        text: milestoneInput.trim(),
        done: false,
        estimatedMins: 5,
      },
    ]);
    setMilestoneInput('');
  };

  // Complete Task with full fireworks confetti
  const handleCompleteTask = () => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#38bdf8', '#a855f7', '#ec4899', '#10b981', '#fbbf24'],
    });
    onToggleComplete(task.id);
  };

  // Time calculations
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const isOverdue = secondsLeft <= 0 && !task.completed;

  // SVG circular progress calculation
  const radius = 150;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, secondsLeft / initialTotalSeconds));
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div
      id="zen-focus-overlay"
      className="fixed inset-0 z-50 bg-[#07090e] text-zinc-100 flex flex-col justify-between overflow-hidden select-none font-sans"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(56, 189, 248, 0.15), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 120%, rgba(99, 102, 241, 0.12), transparent 70%)',
      }}
    >
      {/* Background Animated Glow Orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000"
        style={{
          background: task.completed
            ? 'rgba(16, 185, 129, 0.12)'
            : isPaused
            ? 'rgba(113, 113, 122, 0.08)'
            : activeSound !== 'none'
            ? 'rgba(56, 189, 248, 0.14)'
            : 'rgba(99, 102, 241, 0.12)',
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(pulsePhase * 0.1) * 0.04})`,
        }}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between border-b border-zinc-800/60 bg-[#07090e]/60 backdrop-blur-md">
        {/* Left: Zen Brand & Category */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
                ZEN FOCUS MODE
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-medium text-zinc-400">
                {task.category}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Priority Glowing Accent */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              task.priority === 'urgent'
                ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                : task.priority === 'high'
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
            }`}
          />
          <span className="text-zinc-300 capitalize font-medium">
            {task.priority} Priority
          </span>
        </div>

        {/* Right: Toggle Milestones Drawer & Exit Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isDrawerOpen
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Milestones</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer group shadow-xs active:scale-95"
            title="Exit Focus Mode (Esc)"
          >
            <span>Exit</span>
            <X className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
        </div>
      </header>

      {/* Main Focus Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Center Hero Stopwatch / Countdown Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 pb-8 sm:pb-12 text-center max-w-4xl mx-auto overflow-y-auto">
          {/* Task Title & Description */}
          <div className="max-w-xl mb-4 sm:mb-6 space-y-1.5">
            <h1
              className={`text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight transition-all ${
                task.completed
                  ? 'line-through text-zinc-500'
                  : 'text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]'
              }`}
            >
              {task.title}
            </h1>
            {task.description && (
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Circular SVG Timer Card */}
          <div className="relative flex items-center justify-center mb-5 sm:mb-8 scale-90 sm:scale-100 transition-transform">
            <svg
              className="w-64 h-64 sm:w-76 sm:h-76 md:w-80 md:h-80 -rotate-90 transform drop-shadow-[0_0_25px_rgba(56,189,248,0.15)]"
              viewBox="0 0 340 340"
            >
              {/* Background Track */}
              <circle
                cx="170"
                cy="170"
                r={radius}
                className="stroke-zinc-800/80"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Animated Depleting Progress Bar */}
              <circle
                cx="170"
                cy="170"
                r={radius}
                className={`transition-all duration-1000 ease-linear ${
                  task.completed
                    ? 'stroke-emerald-400'
                    : isOverdue
                    ? 'stroke-rose-500'
                    : 'stroke-sky-400'
                }`}
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={task.completed ? 0 : strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Digits Display */}
            <div className="absolute flex flex-col items-center justify-center font-mono">
              <div className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white flex items-center justify-center">
                {hours > 0 && (
                  <>
                    <span>{String(hours).padStart(2, '0')}</span>
                    <span className="text-zinc-600 px-1 animate-pulse">:</span>
                  </>
                )}
                <span>{String(minutes).padStart(2, '0')}</span>
                <span className="text-zinc-600 px-1 animate-pulse">:</span>
                <span
                  className={
                    task.completed
                      ? 'text-emerald-400'
                      : isPaused
                      ? 'text-zinc-500'
                      : 'text-sky-400'
                  }
                >
                  {String(seconds).padStart(2, '0')}
                </span>
              </div>

              <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-widest text-zinc-400 font-sans font-semibold">
                {task.completed
                  ? '✓ COMPLETED'
                  : isPaused
                  ? 'PAUSED'
                  : isOverdue
                  ? 'DEADLINE REACHED'
                  : 'REMAINING TIME'}
              </div>
            </div>
          </div>

          {/* Quick Action Controls - Elevated with clear buffer above the sound bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Pause</span>
                </>
              )}
            </button>

            {/* +5 Mins */}
            <button
              type="button"
              onClick={() => handleAddMinutes(5)}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>+5m</span>
            </button>

            {/* +15 Mins */}
            <button
              type="button"
              onClick={() => handleAddMinutes(15)}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>+15m</span>
            </button>

            {/* Primary Glowing Action Button: Mark as Done */}
            <button
              type="button"
              onClick={handleCompleteTask}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg ${
                task.completed
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                  : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)]'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{task.completed ? 'Mark as Incomplete' : 'Mark as Done'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible AI Subtask Drawer (Session Milestones) */}
        <aside
          className={`relative z-20 w-80 sm:w-96 border-l border-zinc-800/80 bg-[#090c14]/90 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 ease-in-out ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full absolute right-0 inset-y-0'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-zinc-800/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  Session Milestones
                  <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/80 border border-sky-800/50 px-1.5 py-0.2 rounded-md">
                    AI
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400">Actionable deep-work checklist</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Milestone List Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
            {isLoadingMilestones ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-7 h-7 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-xs text-zinc-400 font-medium animate-pulse">
                  Gemini is breaking down your session...
                </p>
              </div>
            ) : milestones.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs">
                No milestones yet. Add your first step below.
              </div>
            ) : (
              milestones.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleToggleMilestone(m.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                    m.done
                      ? 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
                      : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700 text-zinc-200'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      m.done
                        ? 'bg-sky-500 border-sky-500 text-black'
                        : 'border-zinc-600 group-hover:border-sky-400'
                    }`}
                  >
                    {m.done && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-relaxed ${
                        m.done ? 'line-through text-zinc-500' : 'text-zinc-200 font-medium'
                      }`}
                    >
                      {m.text}
                    </p>
                    {m.estimatedMins && (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1 font-mono">
                        <Clock className="w-2.5 h-2.5" /> ~{m.estimatedMins} min
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Add Subtask Input */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60">
            <form onSubmit={handleAddMilestone} className="flex gap-1.5">
              <input
                type="text"
                value={milestoneInput}
                onChange={(e) => setMilestoneInput(e.target.value)}
                placeholder="Add sub-task..."
                className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              >
                Add
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Ambient Audio & Mood Engine Bottom Dock */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-zinc-800/60 bg-[#07090e]/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Sound Selector Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mr-1">
            <Headphones className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Ambient Mood:</span>
          </div>

          {/* Brown Noise */}
          <button
            type="button"
            onClick={() => handleSoundSelect('brown-noise')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSound === 'brown-noise'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Waves className="w-3 h-3 text-amber-400" />
            <span>Brown Noise</span>
          </button>

          {/* Rain */}
          <button
            type="button"
            onClick={() => handleSoundSelect('rain')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSound === 'rain'
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CloudRain className="w-3 h-3 text-sky-400" />
            <span>Rain</span>
          </button>

          {/* Lo-Fi Beat Simulator */}
          <button
            type="button"
            onClick={() => handleSoundSelect('lofi')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSound === 'lofi'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Music className="w-3 h-3 text-purple-400" />
            <span>Lo-Fi Beats</span>
          </button>

          {/* Café Atmosphere */}
          <button
            type="button"
            onClick={() => handleSoundSelect('cafe')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSound === 'cafe'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Coffee className="w-3 h-3 text-emerald-400" />
            <span>Café</span>
          </button>
        </div>

        {/* Right: Audio Volume Slider & Audio Wave indicator */}
        <div className="flex items-center gap-3">
          {activeSound !== 'none' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900/90 rounded-lg border border-zinc-800">
              <span className="w-1 h-3 bg-sky-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
              <span className="w-1 h-4 bg-sky-400 rounded-full animate-[bounce_1s_infinite_300ms]" />
              <span className="w-1 h-2 bg-sky-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
            </div>
          )}

          <div className="flex items-center gap-2">
            {soundVolume === 0 || activeSound === 'none' ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={handleVolumeChange}
              className="w-20 sm:w-28 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
