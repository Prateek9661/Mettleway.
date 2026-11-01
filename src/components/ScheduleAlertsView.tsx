import React, { useState, useMemo } from 'react';
import {
  Bell,
  Calendar,
  Download,
  Clock,
  Volume2,
  CheckCircle,
  Sparkles,
  ExternalLink,
  CalendarDays,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Layers,
  HelpCircle,
  Check,
  CalendarPlus,
  BookOpen
} from 'lucide-react';
import { Tracker } from '../types';
import { soundAlert } from '../utils/audioAlert';
import {
  exportTrackerToICS,
  calculateUpcomingSessions,
  exportSessionsToICS,
  exportSingleSessionToICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  ScheduledSessionEvent
} from '../utils/calendarExport';

interface ScheduleAlertsViewProps {
  tracker: Tracker;
  onUpdateSchedule: (newTime: string, newDuration: number, newDays: number[]) => void;
}

export const ScheduleAlertsView: React.FC<ScheduleAlertsViewProps> = ({
  tracker,
  onUpdateSchedule,
}) => {
  const [scheduledTime, setScheduledTime] = useState<string>(tracker.scheduledTime);
  const [dailyDuration, setDailyDuration] = useState<number>(tracker.dailyMinutesTarget);
  const [studyDays, setStudyDays] = useState<number[]>(tracker.studyDays);
  const [notificationStatus, setNotificationStatus] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // ICS Export State & Controls
  const [exportMode, setExportMode] = useState<'specific_lessons' | 'recurring'>('specific_lessons');
  const [sessionCountLimit, setSessionCountLimit] = useState<number>(14);
  const [recurringWeeks, setRecurringWeeks] = useState<number>(4);
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false);
  const [showImportHelp, setShowImportHelp] = useState<boolean>(false);
  const [activeCalendarTab, setActiveCalendarTab] = useState<'google' | 'outlook'>('google');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Calculate upcoming specific sessions based on active schedule settings
  const upcomingSessions: ScheduledSessionEvent[] = useMemo(() => {
    const updatedTracker: Tracker = {
      ...tracker,
      scheduledTime,
      dailyMinutesTarget: dailyDuration,
      studyDays,
    };
    return calculateUpcomingSessions(updatedTracker, {
      includeCompleted,
      sessionLimit: sessionCountLimit,
    });
  }, [tracker, scheduledTime, dailyDuration, studyDays, includeCompleted, sessionCountLimit]);

  const nextSession = upcomingSessions[0] || null;

  const toggleDay = (dayIdx: number) => {
    setStudyDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchedule(scheduledTime, dailyDuration, studyDays);
    setToastNotice('Study schedule and alert time updated!');
    setTimeout(() => setToastNotice(null), 3000);
  };

  const handleTestChime = () => {
    soundAlert.playSessionAlertChime();
    setToastNotice('Chime played! That is the sound that alerts you at study time.');
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleRequestNotifications = async () => {
    const granted = await soundAlert.requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
    if (granted) {
      soundAlert.fireNotification('DevTrack Alerts Enabled', {
        body: `You will now receive desktop alerts at ${scheduledTime} on your study days.`,
      });
      setToastNotice('Desktop push notifications enabled!');
    } else {
      setToastNotice('Notification permission was not granted by your browser.');
    }
    setTimeout(() => setToastNotice(null), 3500);
  };

  // Main Export Handler
  const handleExportICS = () => {
    if (exportMode === 'specific_lessons') {
      if (upcomingSessions.length === 0) {
        setToastNotice('No upcoming sessions to export! Try checking "Include completed lessons".');
        setTimeout(() => setToastNotice(null), 4000);
        return;
      }
      exportSessionsToICS(upcomingSessions, tracker.title, reminderMinutes);
      setToastNotice(`Downloaded ${upcomingSessions.length} specific study sessions (.ics) for Google & Outlook Calendar!`);
    } else {
      exportTrackerToICS(
        {
          ...tracker,
          scheduledTime,
          dailyMinutesTarget: dailyDuration,
          studyDays,
        },
        recurringWeeks,
        reminderMinutes
      );
      setToastNotice(`Downloaded ${recurringWeeks}-week recurring study series (.ics) for Google & Outlook!`);
    }
    setTimeout(() => setToastNotice(null), 4500);
  };

  const handleExportSingleSession = (session: ScheduledSessionEvent) => {
    exportSingleSessionToICS(session, reminderMinutes);
    setToastNotice(`Downloaded session: "${session.lessonTitle}" (.ics)!`);
    setTimeout(() => setToastNotice(null), 3500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Alert */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
          <Bell className="w-4 h-4" />
          <span>Scheduled Alarms & Calendar Synchronization</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Personalized Timetable & Calendar Export
        </h1>
        <p className="text-xs text-slate-600 mt-1 max-w-2xl">
          Set your study hours, trigger audio alerts, and export your specific curriculum sessions directly to Google Calendar or Microsoft Outlook with custom reminders.
        </p>
      </div>

      {/* Main Grid: Settings & Alert Controls + Weekly Timetable */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Schedule Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Study Hours & Duration</span>
            </h3>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Study Session Time (24h)
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Alert chimes automatically when your system clock reaches this time.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Daily Study Target
                  </label>
                  <span className="text-xs font-bold font-mono text-indigo-600">
                    {dailyDuration} mins / day
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={150}
                  step={15}
                  value={dailyDuration}
                  onChange={e => setDailyDuration(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Active Study Days
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {dayNames.map((day, idx) => {
                    const isSelected = studyDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`py-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={day}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Save Schedule Changes
              </button>
            </form>
          </div>

          {/* Alert Channels Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>In-App Audio & Desktop Alerts</span>
            </h3>

            {/* Test Audio Chime */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Web Audio Melodic Chime
                </span>
                <span className="text-xs text-slate-500">
                  Plays in-browser sound when study session begins
                </span>
              </div>
              <button
                onClick={handleTestChime}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Test Chime</span>
              </button>
            </div>

            {/* Browser Notifications */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Browser Desktop Notifications
                </span>
                <span className="text-xs text-slate-500">
                  Status: <strong className="font-mono">{notificationStatus}</strong>
                </span>
              </div>
              <button
                onClick={handleRequestNotifications}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
              >
                {notificationStatus === 'granted' ? 'Enabled' : 'Enable Push Alerts'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Timetable & Overview (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Weekly Study Timetable
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {studyDays.length} sessions / week
              </span>
            </div>

            <div className="space-y-2.5">
              {dayNames.map((day, idx) => {
                const isScheduled = studyDays.includes(idx);
                const todayIdx = new Date().getDay();
                const isToday = todayIdx === idx;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-colors flex items-center justify-between text-xs ${
                      isToday
                        ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200'
                        : isScheduled
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-100 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 w-24">
                        {day} {isToday && <span className="text-[10px] text-indigo-600 font-semibold">(Today)</span>}
                      </span>
                      {isScheduled ? (
                        <span className="text-slate-600 font-mono">
                          {scheduledTime} ({dailyDuration}m)
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Rest / Buffer Day</span>
                      )}
                    </div>

                    <div>
                      {isScheduled ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold text-[11px]">
                          Scheduled
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          Off
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
              <strong className="text-slate-800 block">Consistency Pro-Tip:</strong>
              <p>
                Holding study sessions at the exact same hour every day reduces cognitive decision fatigue and turns complex learning into an automatic habit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH DEDICATED CALENDAR EXPORT (ICS) & SYNC SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Google & Outlook Calendar ICS Export</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                  RFC 5545 Standard
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Download your study plan as a universal <code className="font-mono text-indigo-600">.ics</code> file or sync directly with Google Calendar & Outlook.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportHelp(!showImportHelp)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>{showImportHelp ? 'Hide Import Guide' : 'How to Import to Calendar'}</span>
              {showImportHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Step-by-Step Calendar Import Instructions (Expandable) */}
        {showImportHelp && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveCalendarTab('google')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                  activeCalendarTab === 'google'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Google Calendar Instructions
              </button>
              <button
                onClick={() => setActiveCalendarTab('outlook')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                  activeCalendarTab === 'outlook'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Microsoft Outlook Instructions
              </button>
            </div>

            {activeCalendarTab === 'google' ? (
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                <li>Click <strong>Download .ICS File</strong> below to save your study calendar file.</li>
                <li>Open <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5">Google Calendar <ExternalLink className="w-3 h-3" /></a> in your browser.</li>
                <li>In the top right, click the gear icon <strong>Settings</strong> &gt; <strong>Import &amp; export</strong>.</li>
                <li>Under <strong>Import</strong>, select the downloaded <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">.ics</code> file and pick which calendar to add it to.</li>
                <li>Click <strong>Import</strong>. All study sessions will appear with lesson titles, video links, and alarm reminders!</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                <li>Click <strong>Download .ICS File</strong> below to save your study calendar file.</li>
                <li><strong>Outlook Web / 365</strong>: Go to <a href="https://outlook.live.com/calendar" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5">Outlook Calendar <ExternalLink className="w-3 h-3" /></a> &gt; Click <strong>Add calendar</strong> &gt; <strong>Upload from file</strong> &gt; Browse and choose the <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">.ics</code> file.</li>
                <li><strong>Outlook Desktop (Windows/Mac)</strong>: Simply double-click the downloaded <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">.ics</code> file or choose <strong>File &gt; Open &amp; Export &gt; Open Calendar</strong>.</li>
                <li>Your dedicated study sessions and 15-minute start reminders will sync automatically.</li>
              </ol>
            )}
          </div>
        )}

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Export Structure
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setExportMode('specific_lessons')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all text-center cursor-pointer ${
                  exportMode === 'specific_lessons'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Specific Lessons
              </button>
              <button
                type="button"
                onClick={() => setExportMode('recurring')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all text-center cursor-pointer ${
                  exportMode === 'recurring'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Recurring Habit
              </button>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {exportMode === 'specific_lessons'
                ? 'Populates calendar with actual upcoming lesson titles & links.'
                : 'Creates a recurring weekly study block series.'}
            </span>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {exportMode === 'specific_lessons' ? 'Session Count' : 'Duration'}
            </label>
            {exportMode === 'specific_lessons' ? (
              <select
                value={sessionCountLimit}
                onChange={e => setSessionCountLimit(parseInt(e.target.value, 10))}
                className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={7}>Next 7 study sessions (~1 week)</option>
                <option value={14}>Next 14 study sessions (~2 weeks)</option>
                <option value={30}>Next 30 study sessions (~1 month)</option>
                <option value={60}>All remaining lessons</option>
              </select>
            ) : (
              <select
                value={recurringWeeks}
                onChange={e => setRecurringWeeks(parseInt(e.target.value, 10))}
                className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={2}>2 weeks of scheduled alarms</option>
                <option value={4}>4 weeks of scheduled alarms</option>
                <option value={8}>8 weeks of scheduled alarms</option>
                <option value={12}>12 weeks of scheduled alarms</option>
              </select>
            )}
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="checkbox"
                id="includeCompleted"
                checked={includeCompleted}
                onChange={e => setIncludeCompleted(e.target.checked)}
                className="rounded text-indigo-600 cursor-pointer"
              />
              <label htmlFor="includeCompleted" className="text-[11px] text-slate-600 cursor-pointer">
                Include already completed lessons
              </label>
            </div>
          </div>

          {/* Alarm Trigger Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Calendar Alarm Reminder
            </label>
            <select
              value={reminderMinutes}
              onChange={e => setReminderMinutes(parseInt(e.target.value, 10))}
              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value={5}>5 minutes before start</option>
              <option value={10}>10 minutes before start</option>
              <option value={15}>15 minutes before start (Recommended)</option>
              <option value={30}>30 minutes before start</option>
              <option value={60}>1 hour before start</option>
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Triggers a phone notification &amp; desktop popup in Google/Outlook.
            </span>
          </div>
        </div>

        {/* Primary Download & Quick Direct Add Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          {/* Main ICS Download Button */}
          <button
            onClick={handleExportICS}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {exportMode === 'specific_lessons'
                ? `Download .ICS Calendar (${upcomingSessions.length} Study Sessions)`
                : `Download .ICS Calendar (${recurringWeeks}-Week Series)`}
            </span>
          </button>

          {/* Quick Direct Link: Next Session to Google Calendar */}
          {nextSession && (
            <a
              href={getGoogleCalendarUrl(nextSession)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="Add the immediate next study session directly to Google Calendar"
            >
              <CalendarPlus className="w-4 h-4 text-blue-600" />
              <span>Next Session to Google</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          {/* Quick Direct Link: Next Session to Outlook */}
          {nextSession && (
            <a
              href={getOutlookCalendarUrl(nextSession, false)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="Add the immediate next study session directly to Outlook Web"
            >
              <CalendarPlus className="w-4 h-4 text-sky-600" />
              <span>Next Session to Outlook</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}
        </div>

        {/* Preview of Specific Study Sessions to be Exported */}
        {exportMode === 'specific_lessons' && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upcoming Study Sessions Preview ({upcomingSessions.length} total)</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Each event includes specific lesson titles, key concepts, duration &amp; video link
              </span>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                All lessons in this tracker are marked complete! Toggle "Include already completed lessons" above to export past sessions.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {upcomingSessions.map((session, index) => {
                  const dayName = dayNames[session.date.getDay()];
                  const formattedDate = session.date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={session.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center shrink-0 min-w-16">
                          <span className="text-[10px] font-bold text-indigo-600 block uppercase">
                            {dayName.slice(0, 3)}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            {formattedDate}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-400">
                              #{index + 1}
                            </span>
                            <span className="font-bold text-slate-900">
                              {session.lessonTitle}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {session.durationMinutes}m
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-indigo-600 font-semibold">
                              {session.startTime} - {session.endTime}
                            </span>
                            <span>•</span>
                            <span>{session.moduleTitle}</span>
                          </div>

                          {session.keyConcepts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {session.keyConcepts.slice(0, 3).map((concept, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[10px] bg-indigo-50/60 text-indigo-700 px-1.5 py-0.2 rounded"
                                >
                                  {concept}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Individual Session Export Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleExportSingleSession(session)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Download .ICS for this specific session"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={getGoogleCalendarUrl(session)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Add to Google Calendar"
                        >
                          <span>Google</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <a
                          href={getOutlookCalendarUrl(session, false)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Add to Outlook Calendar"
                        >
                          <span>Outlook</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
