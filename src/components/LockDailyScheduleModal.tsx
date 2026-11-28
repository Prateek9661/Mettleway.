import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Calendar,
  Flame,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_METTLEWAY_CLASS_TIME_24,
  DEFAULT_METTLEWAY_CLASS_DURATION_MINS,
  MettlewayScheduleData,
  formatTime24To12Hour,
  isWithinScheduledClassWindow,
  buildMettlewayDailyClassCalendarUrl,
  saveMettlewaySchedule,
  confirmAndLockMettlewayAlarm,
} from '../utils/studyWorkspaceLogic';
import { soundAlert } from '../utils/audioAlert';

interface LockDailyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseName: string;
  streakDays: number;
  scheduleData: MettlewayScheduleData;
  onSaveSchedule: (updated: MettlewayScheduleData, toastMessage?: string) => void;
  pendingRoadmapConfirmLabel?: string;
  onConfirmPendingRoadmap?: (scheduledTime24: string, durationMinutes: number) => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 mins (Focused Sprint)' },
  { value: 45, label: '45 mins (Standard Lecture)' },
  { value: 60, label: '60 mins (Deep Mastery — Default)' },
  { value: 90, label: '90 mins (Intensive Lab)' },
  { value: 120, label: '120 mins (2-Hour Bootcamp)' },
];

const QUICK_TIME_PRESETS = [
  { time24: '16:00', label: '04:00 PM (Default)' },
  { time24: '18:00', label: '06:00 PM' },
  { time24: '20:00', label: '08:00 PM' },
  { time24: '07:00', label: '07:00 AM' },
];

export const LockDailyScheduleModal: React.FC<LockDailyScheduleModalProps> = ({
  isOpen,
  onClose,
  courseName,
  streakDays,
  scheduleData,
  onSaveSchedule,
  pendingRoadmapConfirmLabel,
  onConfirmPendingRoadmap,
}) => {
  const [selectedTime24, setSelectedTime24] = useState<string>(
    scheduleData?.scheduledTime24 || DEFAULT_METTLEWAY_CLASS_TIME_24
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(
    scheduleData?.durationMinutes || DEFAULT_METTLEWAY_CLASS_DURATION_MINS
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedTime24(scheduleData?.scheduledTime24 || DEFAULT_METTLEWAY_CLASS_TIME_24);
      setSelectedDuration(scheduleData?.durationMinutes || DEFAULT_METTLEWAY_CLASS_DURATION_MINS);
    }
  }, [isOpen, scheduleData?.scheduledTime24, scheduleData?.durationMinutes]);

  if (!isOpen) return null;

  const effectiveCourseName = (
    courseName ||
    scheduleData?.courseName ||
    "Striver's A2Z DSA Master Path"
  ).trim();
  const formatted12Hour = formatTime24To12Hour(selectedTime24);
  const currentUrl =
    typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : 'https://mettleway.app/';

  const googleCalendarUrl = buildMettlewayDailyClassCalendarUrl({
    courseName: effectiveCourseName,
    scheduledTime24: selectedTime24,
    durationMinutes: selectedDuration,
    joinUrl: currentUrl,
  });

  const isWithinWindowNow = isWithinScheduledClassWindow(selectedTime24, new Date(), 30);

  const handleTimeChange = (nextTime24: string) => {
    setSelectedTime24(nextTime24);
    const saved = saveMettlewaySchedule({
      scheduledTime24: nextTime24,
      durationMinutes: selectedDuration,
      courseName: effectiveCourseName,
      streakDays,
    });
    onSaveSchedule(saved);
  };

  const handleDurationChange = (nextDuration: number) => {
    setSelectedDuration(nextDuration);
    const saved = saveMettlewaySchedule({
      scheduledTime24: selectedTime24,
      durationMinutes: nextDuration,
      courseName: effectiveCourseName,
      streakDays,
    });
    onSaveSchedule(saved);
  };

  const handleSetToCurrentTimeForVerification = () => {
    const now = new Date();
    const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const nowTime24 = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    setSelectedTime24(nowTime24);
    const saved = saveMettlewaySchedule({
      scheduledTime24: nowTime24,
      durationMinutes: selectedDuration,
      courseName: effectiveCourseName,
      streakDays,
      attendanceVerifiedToday: true,
    });
    onSaveSchedule(saved);
  };

  // Direct Google Calendar sync: saves schedule to mettleway_schedule, closes modal, and lets anchor open Google Calendar in a new tab
  const handleSyncAndCloseModal = () => {
    soundAlert.playSessionAlertChime();
    const { schedule, toastMessage } = confirmAndLockMettlewayAlarm({
      scheduledTime24: selectedTime24,
      durationMinutes: selectedDuration,
      courseName: effectiveCourseName,
      streakDays,
    });
    onSaveSchedule(schedule, toastMessage);
    if (onConfirmPendingRoadmap) {
      onConfirmPendingRoadmap(selectedTime24, selectedDuration);
    }
    onClose();
  };

  return (
    <div
      data-testid="lock-daily-schedule-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-daily-schedule-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 text-zinc-100 relative overflow-hidden">
        {/* Top Forge Amber Accent Glow Strip */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Mettleway. Accountability Protocol</span>
            </div>
            <h2
              id="lock-daily-schedule-title"
              className="text-xl font-extrabold tracking-tight text-white"
            >
              Lock Your Daily Class Schedule
            </h2>
            <p
              data-testid="lock-daily-schedule-subtitle"
              className="text-xs text-zinc-300 leading-relaxed"
            >
              YouTube courses fail without discipline. Treat Mettleway. like a live paid course.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule modal"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Course Banner */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Locked Course Track
            </span>
            <span className="text-xs font-bold text-white truncate block">
              🔴 Mettleway. Live Class: {effectiveCourseName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 shrink-0">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{streakDays}d Streak</span>
          </div>
        </div>

        {/* Time Selector & Duration Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Daily Class Time Selector (Default: 04:00 PM / 16:00) */}
          <div className="space-y-1.5">
            <label
              htmlFor="mettleway-time-input"
              className="block text-xs font-bold text-zinc-200 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Daily Class Time</span>
              </span>
              <span className="font-mono text-amber-400 font-extrabold">{formatted12Hour}</span>
            </label>
            <input
              id="mettleway-time-input"
              data-testid="mettleway-time-selector"
              type="time"
              value={selectedTime24}
              onChange={e => handleTimeChange(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-zinc-900 border border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-white focus:outline-none"
            />
          </div>

          {/* Class Duration Selector (Default: 60 mins) */}
          <div className="space-y-1.5">
            <label
              htmlFor="mettleway-duration-select"
              className="block text-xs font-bold text-zinc-200 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Session Duration</span>
              </span>
              <span className="font-mono text-amber-400 font-extrabold">
                {selectedDuration} mins
              </span>
            </label>
            <select
              id="mettleway-duration-select"
              data-testid="mettleway-duration-selector"
              value={selectedDuration}
              onChange={e => handleDurationChange(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2.5 text-xs font-bold bg-zinc-900 border border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-white focus:outline-none cursor-pointer"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Time Presets + Attendance Window Check */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">Quick Time Slots:</span>
            <button
              type="button"
              data-testid="set-class-time-now-btn"
              onClick={handleSetToCurrentTimeForVerification}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Set to Current Time (Verify Attendance +50 XP Now)
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TIME_PRESETS.map(preset => {
              const active = selectedTime24 === preset.time24;
              return (
                <button
                  key={preset.time24}
                  type="button"
                  onClick={() => handleTimeChange(preset.time24)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-amber-500/50 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendance Verification Window Status */}
        <div
          className={`rounded-xl px-3.5 py-2.5 border text-xs flex items-center justify-between gap-2 ${
            isWithinWindowNow || scheduleData?.attendanceVerifiedToday
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-zinc-900/70 border-zinc-800 text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-4 h-4 shrink-0 ${
                isWithinWindowNow || scheduleData?.attendanceVerifiedToday
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            />
            <span>
              {isWithinWindowNow || scheduleData?.attendanceVerifiedToday
                ? 'You are within 30 mins of your scheduled class time — Attendance Verified (+50 XP)!'
                : `Open your lecture within 30 mins of ${formatted12Hour} to earn Attendance Verified (+50 XP).`}
            </span>
          </div>
        </div>

        {/* Primary Action: Opens Google Calendar Recurring Event in New Tab, Saves Schedule & Closes Modal */}
        <div className="space-y-2.5 pt-1">
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="sync-google-calendar-btn"
            onClick={handleSyncAndCloseModal}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span>📅 Sync Daily Class to Google Calendar (Set Phone Alarms)</span>
            <ExternalLink className="w-4 h-4 shrink-0" />
          </a>

          <p className="text-[11px] text-zinc-400 text-center">
            Opens Google Calendar in a new tab with daily recurrence (<code className="font-mono text-amber-400">RRULE:FREQ=DAILY</code>) so phone &amp; desktop alarms sync automatically.
          </p>

          {/* Secondary Lock & Continue Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-lock-schedule-btn"
              onClick={handleSyncAndCloseModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-300 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/50 rounded-xl transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{pendingRoadmapConfirmLabel || `Lock ${formatted12Hour} & Continue`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

