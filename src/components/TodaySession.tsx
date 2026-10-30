import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, ExternalLink, Bell, Sparkles, BookOpen, Clock, Lightbulb, PartyPopper } from 'lucide-react';
import { Tracker, Lesson } from '../types';
import { soundAlert } from '../utils/audioAlert';
import { ConfettiCelebration } from './ConfettiCelebration';

interface TodaySessionProps {
  activeTracker: Tracker | null;
  streakDays: number;
  onCompleteLesson: (lessonId: string, notes?: string, minutesStudied?: number) => void;
  onSwitchToMentor: () => void;
  onOpenCreateModal: () => void;
}

export const TodaySession: React.FC<TodaySessionProps> = ({
  activeTracker,
  streakDays,
  onCompleteLesson,
  onSwitchToMentor,
  onOpenCreateModal,
}) => {
  // Timer state
  const defaultMinutes = activeTracker?.dailyMinutesTarget || 60;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Celebration overlay state
  const [isCelebrationOpen, setIsCelebrationOpen] = useState<boolean>(false);
  const [celebrationDetails, setCelebrationDetails] = useState<{ title: string; minutes: number }>({
    title: '',
    minutes: defaultMinutes,
  });

  // Sync timer when tracker changes
  useEffect(() => {
    if (activeTracker) {
      setSecondsRemaining(activeTracker.dailyMinutesTarget * 60);
      setIsTimerRunning(false);
      setHasStartedSession(false);
    }
  }, [activeTracker?.id, activeTracker?.dailyMinutesTarget]);

  // Find next uncompleted lesson
  const currentLesson: Lesson | null = React.useMemo(() => {
    if (!activeTracker) return null;
    for (const mod of activeTracker.modules) {
      for (const les of mod.lessons) {
        if (!les.completed) return les;
      }
    }
    return null;
  }, [activeTracker]);

  // Find previous completed lessons for recap
  const recentlyCompletedLesson: Lesson | null = React.useMemo(() => {
    if (!activeTracker) return null;
    const completedList: Lesson[] = [];
    for (const mod of activeTracker.modules) {
      for (const les of mod.lessons) {
        if (les.completed) completedList.push(les);
      }
    }
    return completedList.length > 0 ? completedList[completedList.length - 1] : null;
  }, [activeTracker]);

  // Interval timer tick
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            soundAlert.playSessionAlertChime();
            soundAlert.playCompletionChime();
            soundAlert.fireNotification("Study Session Completed!", {
              body: `Great job! You finished your scheduled ${activeTracker?.dailyMinutesTarget} minute session.`,
            });
            setCelebrationDetails({
              title: currentLesson?.title || "Daily Study Session",
              minutes: activeTracker?.dailyMinutesTarget || 60,
            });
            setIsCelebrationOpen(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, secondsRemaining, activeTracker, currentLesson]);

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Compute today's total minutes studied towards dailyMinutesTarget
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const minutesFromCompletedLessonsToday = React.useMemo(() => {
    if (!activeTracker) return 0;
    let total = 0;
    activeTracker.modules.forEach(m => {
      m.lessons.forEach(l => {
        if (l.completed && l.completedAt && l.completedAt.slice(0, 10) === todayDateStr) {
          total += l.durationMinutes;
        }
      });
    });
    return total;
  }, [activeTracker, todayDateStr]);

  const targetMinutes = activeTracker?.dailyMinutesTarget || 60;
  const targetSeconds = targetMinutes * 60;
  const sessionMinutesElapsed = Math.max(0, Math.floor((targetSeconds - secondsRemaining) / 60));
  const totalDailyMinutesStudied = minutesFromCompletedLessonsToday + sessionMinutesElapsed;
  const progressRatio = Math.min(1, totalDailyMinutesStudied / targetMinutes);
  const progressPercent = Math.min(100, Math.round((totalDailyMinutesStudied / targetMinutes) * 100));

  // Circular progress SVG math: radius = 95, circumference = 2 * PI * 95 = 596.9
  const circleRadius = 95;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - progressRatio * circleCircumference;

  const handleTestAlert = () => {
    soundAlert.playSessionAlertChime();
    soundAlert.fireNotification("DevTrack Session Alert Test", {
      body: `Your scheduled study time for ${activeTracker?.title || 'DSA'} is active!`,
    });
    setToastMessage("🔔 Alert chime played & notification fired!");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTriggerCelebrationTest = () => {
    soundAlert.playCompletionChime();
    setCelebrationDetails({
      title: currentLesson?.title || "Daily Study Session",
      minutes: activeTracker?.dailyMinutesTarget || 60,
    });
    setIsCelebrationOpen(true);
  };

  const handleMarkComplete = () => {
    if (!currentLesson) return;
    soundAlert.playCompletionChime();
    const minutesStudied = Math.round((activeTracker!.dailyMinutesTarget * 60 - secondsRemaining) / 60) || currentLesson.durationMinutes;
    const finalMinutes = Math.max(minutesStudied, 15);
    onCompleteLesson(currentLesson.id, sessionNotes, finalMinutes);
    setCelebrationDetails({
      title: currentLesson.title,
      minutes: finalMinutes,
    });
    setIsCelebrationOpen(true);
    setSessionNotes('');
    setToastMessage("🎉 Awesome! Lesson marked complete and milestone streak extended!");
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!activeTracker) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">No Active Study Track</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
          Instead of buying expensive 10k courses, import any YouTube playlist or syllabus to generate a personalized daily tracker.
        </p>
        <button
          onClick={onOpenCreateModal}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          Import First Playlist / Course
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Session Banner & Schedule Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{activeTracker.category}</span>
              <span aria-hidden="true">·</span>
              <span>By {activeTracker.instructor}</span>
              <span aria-hidden="true">·</span>
              <span>{activeTracker.difficulty}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTracker.title}
            </h1>
          </div>

          {/* Schedule status and quick test chime & celebration preview */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 p-2.5 rounded-xl self-start md:self-auto">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Scheduled: <strong className="font-mono tabular-nums">{activeTracker.scheduledTime}</strong> ({activeTracker.dailyMinutesTarget}m daily)</span>
            </div>
            <button
              onClick={handleTestAlert}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
              title="Test the Web Audio session alert chime"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Test Chime</span>
            </button>
            <button
              onClick={handleTriggerCelebrationTest}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
              title="Preview milestone celebration & confetti burst"
            >
              <PartyPopper className="w-3.5 h-3.5" />
              <span>Preview Milestone</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Focus Timer + Today's Lesson */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Focus Session Timer & Circular Progress Bar (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center">
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Daily Study Progress
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-indigo-600">
              {totalDailyMinutesStudied} / {targetMinutes}m ({progressPercent}%)
            </span>
          </div>

          {/* Visual Circular Progress Bar Display */}
          <div className="relative my-4 flex items-center justify-center">
            {/* SVG Progress Ring */}
            <svg
              className="w-56 h-56 transform -rotate-90 drop-shadow-xs"
              viewBox="0 0 230 230"
              aria-label={`Daily progress: ${progressPercent}%`}
            >
              {/* Background Track */}
              <circle
                cx="115"
                cy="115"
                r={circleRadius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth="12"
              />
              {/* Animated Foreground Progress Circle */}
              <circle
                cx="115"
                cy="115"
                r={circleRadius}
                fill="transparent"
                stroke={progressPercent >= 100 ? "#10B981" : "#4F46E5"}
                strokeWidth="12"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>

            {/* Content inside the circular progress ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold tracking-tight font-mono tabular-nums text-slate-900">
                {formatTime(secondsRemaining)}
              </span>

              <div className="text-[11px] font-medium text-slate-600 mt-1 flex items-center gap-1">
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {totalDailyMinutesStudied}m
                </span>
                <span className="text-slate-400">/</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {targetMinutes}m target
                </span>
              </div>

              {progressPercent >= 100 ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5 flex items-center gap-1 shadow-xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Goal Achieved!</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full mt-1.5">
                  {isTimerRunning ? 'Session active' : `${progressPercent}% complete`}
                </span>
              )}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setIsTimerRunning(!isTimerRunning);
                setHasStartedSession(true);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer ${
                isTimerRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Pause Timer</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>{hasStartedSession ? 'Resume Session' : 'Start Study Session'}</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsTimerRunning(false);
                setSecondsRemaining(activeTracker.dailyMinutesTarget * 60);
              }}
              className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Reset timer"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Quick preset increments */}
          <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-4 w-full justify-center">
            <span>Adjust:</span>
            <button
              onClick={() => setSecondsRemaining(prev => prev + 300)}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono cursor-pointer"
            >
              +5m
            </button>
            <button
              onClick={() => setSecondsRemaining(prev => prev + 900)}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono cursor-pointer"
            >
              +15m
            </button>
            <button
              onClick={() => setSecondsRemaining(activeTracker.dailyMinutesTarget * 60)}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono cursor-pointer"
            >
              Default ({activeTracker.dailyMinutesTarget}m)
            </button>
          </div>
        </div>

        {/* Right Column: Today's Assigned Lesson & Notes (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {currentLesson ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Today's Scheduled Lesson
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {currentLesson.durationMinutes} mins
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  {currentLesson.title}
                </h2>
                {/* Clean unboxed concept metadata */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                  <span>Concepts:</span>
                  {currentLesson.keyConcepts.map((concept, i) => (
                    <React.Fragment key={i}>
                      <span className="text-slate-800 font-medium">{concept}</span>
                      {i < currentLesson.keyConcepts.length - 1 && <span aria-hidden="true">·</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Practice Task Box */}
              {currentLesson.practiceTask && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hands-On Practice Task:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed pl-5">
                    {currentLesson.practiceTask}
                  </p>
                </div>
              )}

              {/* Action Buttons: Watch Video + Mark Completed */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href={currentLesson.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open YouTube Lesson</span>
                </a>

                <button
                  onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm cursor-pointer ml-auto"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Completed Today</span>
                </button>
              </div>

              {/* Study Notes text area */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Lesson Notes & Key Takeaways:
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  placeholder="Record what clicked today, tricky edge cases, or code syntax to remember..."
                  rows={3}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50/50"
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-900">All Scheduled Lessons Completed!</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                You have finished every lesson in this track! Review concepts with the AI Mentor or import your next playlist.
              </p>
            </div>
          )}

          {/* Yesterday's Recap Card (Concept Continuity) */}
          {recentlyCompletedLesson && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Previous Lesson Mastered</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">{recentlyCompletedLesson.title}</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {recentlyCompletedLesson.notes || "Solid foundation logged. Remember to practice applying these concepts in real LeetCode or project tasks today."}
                </p>
                <button
                  onClick={onSwitchToMentor}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 pt-1 cursor-pointer"
                >
                  <span>Review full AI recap & test doubts</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Celebration & Confetti Milestone Overlay */}
      <ConfettiCelebration
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        streakDays={streakDays}
        lessonTitle={celebrationDetails.title}
        minutesStudied={celebrationDetails.minutes}
        onNavigateToMentor={onSwitchToMentor}
      />
    </div>
  );
};
