import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskCategory, ChecklistItem } from '../types';
import { X, Plus, Trash2, Calendar, Clock, Tag, AlertCircle, Sparkles, Check, Palette, Shuffle } from 'lucide-react';
import { formatDateToISO, PRESET_TASK_COLORS, getRandomColor } from '../utils/dateUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (taskData: Omit<Task, 'id' | 'createdAt'>, existingTaskId?: string) => void;
  initialDateStr: string;
  taskToEdit?: Task | null;
}

const CATEGORIES: TaskCategory[] = [
  'Work',
  'Personal',
  'Study',
  'Health',
  'Finance',
  'Project',
  'Other',
];

const PRIORITIES: { label: string; value: TaskPriority; color: string }[] = [
  { label: 'Low', value: 'low', color: 'bg-zinc-100 text-zinc-700' },
  { label: 'Medium', value: 'medium', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { label: 'High', value: 'high', color: 'bg-amber-50 text-amber-800 border border-amber-200' },
  { label: 'Urgent', value: 'urgent', color: 'bg-rose-50 text-rose-700 border border-rose-200' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSaveTask,
  initialDateStr,
  taskToEdit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(initialDateStr);
  const [time, setTime] = useState('17:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [pinnedCountdown, setPinnedCountdown] = useState(false);
  const [color, setColor] = useState<string>(''); // empty string means "Auto / Random"
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setDate(taskToEdit.date);
      setTime(taskToEdit.time || '17:00');
      setIsAllDay(taskToEdit.isAllDay);
      setPriority(taskToEdit.priority);
      setCategory(taskToEdit.category);
      setColor(taskToEdit.color || '');
      setPinnedCountdown(!!taskToEdit.pinnedCountdown);
      setChecklist(taskToEdit.checklist || []);
    } else {
      setTitle('');
      setDescription('');
      setDate(initialDateStr || formatDateToISO(new Date()));
      setTime('17:00');
      setIsAllDay(false);
      setPriority('medium');
      setCategory('Work');
      setColor('');
      setPinnedCountdown(false);
      setChecklist([]);
    }
  }, [taskToEdit, initialDateStr, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Use user-selected specific color or generate a vibrant random color
    const finalColor = color.trim() ? color.trim() : getRandomColor();

    onSaveTask(
      {
        title: title.trim(),
        description: description.trim(),
        date,
        time: isAllDay ? '' : time,
        isAllDay,
        priority,
        category,
        color: finalColor,
        completed: taskToEdit ? taskToEdit.completed : false,
        pinnedCountdown,
        checklist,
      },
      taskToEdit?.id
    );
    onClose();
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist([
      ...checklist,
      {
        id: `check-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: newChecklistText.trim(),
        done: false,
      },
    ]);
    setNewChecklistText('');
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  // Quick Preset Handlers
  const handleSetQuickPreset = (preset: 'today' | 'tomorrow' | 'in3days' | 'nextWeek') => {
    const now = new Date();
    if (preset === 'today') {
      setDate(formatDateToISO(now));
      setTime('18:00');
    } else if (preset === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      setDate(formatDateToISO(d));
      setTime('10:00');
    } else if (preset === 'in3days') {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      setDate(formatDateToISO(d));
      setTime('15:00');
    } else if (preset === 'nextWeek') {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      setDate(formatDateToISO(d));
      setTime('09:00');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white border border-zinc-200 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                {taskToEdit ? 'Edit Scheduled Task' : 'Assign New Task'}
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500">
                Configure deadline and real-time countdown.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content with vertical scroll & extra bottom padding */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-4 sm:px-6 pt-4 pb-28 sm:pb-6 space-y-4 flex-1 relative"
        >
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handleSetQuickPreset('today')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg border border-zinc-200 cursor-pointer"
            >
              Today (6 PM)
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickPreset('tomorrow')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg border border-zinc-200 cursor-pointer"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickPreset('in3days')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg border border-zinc-200 cursor-pointer"
            >
              In 3 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickPreset('nextWeek')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg border border-zinc-200 cursor-pointer"
            >
              Next Week
            </button>
          </div>

          {/* Task Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 block">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Finish Quarterly Report, Launch Campaign..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white text-sm font-semibold text-zinc-900 border border-zinc-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
              autoFocus
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Scheduled Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-50 focus:bg-white text-xs font-medium text-zinc-900 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Due Time
                </label>
                <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-0"
                  />
                  All Day
                </label>
              </div>
              <input
                type="time"
                disabled={isAllDay}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`w-full text-xs font-medium border rounded-xl px-3 py-2 outline-none transition-all ${
                  isAllDay
                    ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                    : 'bg-zinc-50 focus:bg-white text-zinc-900 border-zinc-200 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900'
                }`}
              />
            </div>
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full bg-zinc-50 focus:bg-white text-xs font-medium text-zinc-900 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 block">Priority</label>
              <div className="grid grid-cols-4 gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                      priority === p.value
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Countdown Bar & Theme Color */}
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-zinc-500" />
                <span>Countdown Bar & Card Color</span>
              </label>
              <span className="text-[11px] text-zinc-400">
                {color ? 'Custom color' : 'Auto random color'}
              </span>
            </div>

            {/* Color Swatches Grid */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Auto / Random Option */}
              <button
                type="button"
                onClick={() => setColor('')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  color === ''
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
                title="Assign random vibrant color automatically"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Auto Random</span>
              </button>

              {/* Preset Swatches */}
              {PRESET_TASK_COLORS.map((c) => {
                const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center shadow-2xs hover:scale-110 active:scale-95 ${
                      isSelected ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110' : ''
                    }`}
                    title={c.name}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />}
                  </button>
                );
              })}

              {/* Custom Color Input Picker */}
              <label
                className="w-7 h-7 rounded-full border border-dashed border-zinc-300 hover:border-zinc-500 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 relative bg-gradient-to-tr from-sky-400 via-rose-400 to-amber-400 p-0.5"
                title="Custom color hex picker"
              >
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-700">
                  +
                </div>
                <input
                  type="color"
                  value={color || '#3b82f6'}
                  onChange={(e) => setColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Live Countdown Bar Preview */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-600 font-medium">
                <span>Countdown Bar Preview</span>
                <span className="font-mono text-[10px] font-bold" style={{ color: color || '#0284c7' }}>
                  {color ? color : 'Random Palette (Auto)'}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: '65%',
                    backgroundColor: color || '#0284c7',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notes / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 block">Notes & Details</label>
            <textarea
              rows={2}
              placeholder="Add extra context, deliverables, or checklist details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white text-xs text-zinc-800 border border-zinc-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
            />
          </div>

          {/* Sub-Checklist (Optional) */}
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <label className="text-xs font-bold text-zinc-700 block">Sub-tasks Checklist</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add sub-task step..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="flex-1 bg-zinc-50 focus:bg-white text-xs border border-zinc-200 rounded-xl px-3 py-1.5 outline-none"
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Add
              </button>
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-zinc-50 px-2.5 py-1.5 rounded-lg text-xs"
                  >
                    <span className="text-zinc-700 truncate">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="text-zinc-400 hover:text-rose-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pin as Focus Countdown Toggle */}
          <div className="border-t border-zinc-100 pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-800 block">Focus Countdown</span>
              <span className="text-[11px] text-zinc-500">
                Pin this task to the main banner countdown timer
              </span>
            </div>
            <input
              type="checkbox"
              checked={pinnedCountdown}
              onChange={(e) => setPinnedCountdown(e.target.checked)}
              className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Footer Actions: Sticky at bottom */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 border-t border-zinc-200 flex items-center justify-end gap-2.5 z-20 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[42px] text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-5 py-2.5 min-h-[42px] text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 text-center"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{taskToEdit ? 'Save Changes' : 'Create Countdown'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
