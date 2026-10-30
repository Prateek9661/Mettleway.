import React, { useState } from 'react';
import { Bell, Calendar, Download, Clock, Volume2, ShieldCheck, CheckCircle, Sparkles } from 'lucide-react';
import { Tracker } from '../types';
import { soundAlert } from '../utils/audioAlert';
import { exportTrackerToICS } from '../utils/calendarExport';

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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleDay = (dayIdx: number) => {
    setStudyDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchedule(scheduledTime, dailyDuration, studyDays);
    setToastNotice('✅ Study schedule and alert time updated!');
    setTimeout(() => setToastNotice(null), 3000);
  };

  const handleTestChime = () => {
    soundAlert.playSessionAlertChime();
    setToastNotice('🔔 Chime played! That is the sound that alerts you at study time.');
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleRequestNotifications = async () => {
    const granted = await soundAlert.requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
    if (granted) {
      soundAlert.fireNotification('DevTrack Alerts Enabled', {
        body: `You will now receive desktop alerts at ${scheduledTime} on your study days.`,
      });
      setToastNotice('🔔 Desktop push notifications enabled!');
    } else {
      setToastNotice('⚠️ Notification permission was not granted by your browser.');
    }
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleExportCalendar = () => {
    exportTrackerToICS({
      ...tracker,
      scheduledTime,
      dailyMinutesTarget: dailyDuration,
      studyDays,
    });
    setToastNotice('📅 Calendar schedule (.ics) downloaded! Open it to add to Google/Apple Calendar.');
    setTimeout(() => setToastNotice(null), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Alert */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm flex items-center gap-2 animate-bounce">
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
          Personalized Timetable & Alert Settings
        </h1>
        <p className="text-xs text-slate-600 mt-1 max-w-2xl">
          Set the exact hours you are free to study. DevTrack automatically rings an in-app chime, triggers desktop alerts, and syncs with your Google/Apple Calendar.
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

          {/* Alert Channels & Calendar Export Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>Multi-Channel Alert Configuration</span>
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

            {/* Google / Apple Calendar .ICS Export */}
            <div className="flex items-center justify-between p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  Export to Calendar (.ICS)
                </span>
                <span className="text-xs text-indigo-900">
                  Adds 4 weeks of scheduled sessions with alarms to your phone
                </span>
              </div>
              <button
                onClick={handleExportCalendar}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Schedule Timetable Grid (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
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
                  className={`p-3.5 rounded-xl border transition-colors flex items-center justify-between text-xs ${
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
                        Session Scheduled
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
  );
};
