import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  ExternalLink,
  Bell,
  Sparkles,
  BookOpen,
  Clock,
  Lightbulb,
  PartyPopper,
  Plus,
  Trash2,
  ListTodo,
  GraduationCap,
  Map,
  Shield,
} from 'lucide-react';
import { Tracker, Lesson, StudyTask } from '../types';
import { soundAlert } from '../utils/audioAlert';
import {
  getCurrentUncompletedLesson,
  calculateCourseProgress,
  generateDailyStudyChecklist,
  filterStudyTasks,
  getCourseThemeTokens,
  resolveLessonVideoUrl,
} from '../utils/studyWorkspaceLogic';
import { ConfettiCelebration } from './ConfettiCelebration';

interface TodaySessionProps {
  activeTracker: Tracker | null;
  streakDays: number;
  onCompleteLesson: (lessonId: string, notes?: string, minutesStudied?: number) => void;
  onToggleLesson: (lessonId: string) => void;
  onSwitchToMentor: () => void;
  onSwitchToCurriculum: () => void;
  onOpenCreateModal: () => void;
  isDeepWork?: boolean;
  onToggleDeepWork?: () => void;
}

export const TodaySession: React.FC<TodaySessionProps> = ({
  activeTracker,
  streakDays,
  onCompleteLesson,
  onToggleLesson,
  onSwitchToMentor,
  onSwitchToCurriculum,
  onOpenCreateModal,
  isDeepWork = false,
  onToggleDeepWork,
}) => {
  // Timer state
  const defaultMinutes = activeTracker?.dailyMinutesTarget || 60;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Task Tracker state (persisted per tracker in localStorage)
  const [customTasks, setCustomTasks] = useState<StudyTask[]>([]);
  const [builtInChecks, setBuiltInChecks] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskCategory, setNewTaskCategory] = useState<StudyTask['category']>('practice');
  const [newTaskMinutes, setNewTaskMinutes] = useState<number>(20);
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'done'>('all');

  // Celebration overlay state
  const [isCelebrationOpen, setIsCelebrationOpen] = useState<boolean>(false);
  const [celebrationDetails, setCelebrationDetails] = useState<{ title: string; minutes: number }>({
    title: '',
    minutes: defaultMinutes,
  });

  // Sync timer, reset session state & load course-specific tasks whenever activeTracker or courseUrl changes
  useEffect(() => {
    if (activeTracker) {
      setSecondsRemaining(activeTracker.dailyMinutesTarget * 60);
      setIsTimerRunning(false);
      setHasStartedSession(false);
      setSessionNotes('');
      setTaskFilter('all');

      try {
        const savedTasks = localStorage.getItem(`devtrack_custom_tasks_${activeTracker.id}`);
        if (savedTasks) {
          setCustomTasks(JSON.parse(savedTasks));
        } else {
          setCustomTasks([
            {
              id: `default-task-1-${activeTracker.id}`,
              title: `Complete 1 hands-on coding exercise for ${activeTracker.title}`,
              category: 'practice',
              estimatedMinutes: 25,
              completed: false,
            },
            {
              id: `default-task-2-${activeTracker.id}`,
              title: `Summarize core concepts from today's ${activeTracker.category} lecture`,
              category: 'revision',
              estimatedMinutes: 10,
              completed: false,
            },
          ]);
        }
      } catch {
        setCustomTasks([]);
      }

      try {
        const savedBuiltIn = localStorage.getItem(`devtrack_builtin_checks_${activeTracker.id}`);
        if (savedBuiltIn) {
          setBuiltInChecks(JSON.parse(savedBuiltIn));
        } else {
          setBuiltInChecks({});
        }
      } catch {
        setBuiltInChecks({});
      }
    }
  }, [activeTracker?.id, activeTracker?.sourceUrl, activeTracker?.title, activeTracker?.dailyMinutesTarget]);

  // Persist custom tasks
  useEffect(() => {
    if (!activeTracker) return;
    try {
      localStorage.setItem(`devtrack_custom_tasks_${activeTracker.id}`, JSON.stringify(customTasks));
    } catch {}
  }, [customTasks, activeTracker]);

  // Persist built-in checks
  useEffect(() => {
    if (!activeTracker) return;
    try {
      localStorage.setItem(`devtrack_builtin_checks_${activeTracker.id}`, JSON.stringify(builtInChecks));
    } catch {}
  }, [builtInChecks, activeTracker]);

  // Find next uncompleted lesson
  const currentLesson: Lesson | null = React.useMemo(
    () => getCurrentUncompletedLesson(activeTracker),
    [activeTracker]
  );

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

  // Overall course progress stats
  const courseProgress = React.useMemo(
    () => calculateCourseProgress(activeTracker),
    [activeTracker]
  );

  // Combined Daily Study Checklist (Curriculum-linked tasks + Custom learner tasks)
  const allDailyTasks: StudyTask[] = React.useMemo(
    () => generateDailyStudyChecklist(currentLesson, builtInChecks, customTasks, sessionNotes),
    [currentLesson, builtInChecks, customTasks, sessionNotes]
  );

  const filteredTasks = React.useMemo(
    () => filterStudyTasks(allDailyTasks, taskFilter),
    [allDailyTasks, taskFilter]
  );

  const completedTasksCount = allDailyTasks.filter(t => t.completed).length;
  const totalTasksCount = allDailyTasks.length;
  const taskCompletionPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Toggle any task in the checklist
  const handleToggleStudyTask = (task: StudyTask) => {
    if (task.linkedLessonId) {
      onToggleLesson(task.linkedLessonId);
      setToastMessage('Lesson status updated in your curriculum roadmap.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (task.id.startsWith('practice-') || task.id.startsWith('notes-')) {
      const nextVal = !builtInChecks[task.id];
      if (nextVal) soundAlert.playCompletionChime();
      setBuiltInChecks(prev => ({ ...prev, [task.id]: nextVal }));
      return;
    }

    setCustomTasks(prev =>
      prev.map(t => {
        if (t.id === task.id) {
          const next = !t.completed;
          if (next) soundAlert.playCompletionChime();
          return { ...t, completed: next };
        }
        return t;
      })
    );
  };

  // Add a new custom learner task
  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;

    const newTask: StudyTask = {
      id: `custom-${Date.now()}`,
      title: trimmed,
      category: newTaskCategory,
      estimatedMinutes: Math.max(5, Math.min(180, Number(newTaskMinutes) || 20)),
      completed: false,
    };

    setCustomTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setToastMessage('Task added to your daily study checklist.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Delete a custom learner task
  const handleDeleteCustomTask = (taskId: string) => {
    setCustomTasks(prev => prev.filter(t => t.id !== taskId));
  };

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
            soundAlert.fireNotification('Study Session Completed!', {
              body: `Great job! You finished your scheduled ${activeTracker?.dailyMinutesTarget} minute session.`,
            });
            setCelebrationDetails({
              title: currentLesson?.title || 'Daily Study Session',
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

  // Circular progress SVG math: radius = 88
  const circleRadius = 88;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - progressRatio * circleCircumference;

  const handleTestAlert = () => {
    soundAlert.playSessionAlertChime();
    soundAlert.fireNotification('DevTrack Session Alert Test', {
      body: `Your scheduled study time for ${activeTracker?.title || 'DSA'} is active!`,
    });
    setToastMessage('Alert chime played & notification fired.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTriggerCelebrationTest = () => {
    soundAlert.playCompletionChime();
    setCelebrationDetails({
      title: currentLesson?.title || 'Daily Study Session',
      minutes: activeTracker?.dailyMinutesTarget || 60,
    });
    setIsCelebrationOpen(true);
  };

  const handleMarkComplete = () => {
    if (!currentLesson) return;
    soundAlert.playCompletionChime();
    const minutesStudied =
      Math.round((activeTracker!.dailyMinutesTarget * 60 - secondsRemaining) / 60) ||
      currentLesson.durationMinutes;
    const finalMinutes = Math.max(minutesStudied, 15);
    onCompleteLesson(currentLesson.id, sessionNotes, finalMinutes);
    setCelebrationDetails({
      title: currentLesson.title,
      minutes: finalMinutes,
    });
    setIsCelebrationOpen(true);
    setSessionNotes('');
    setToastMessage('Lesson marked complete and daily streak extended!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const categoryLabel = (cat: StudyTask['category']) => {
    switch (cat) {
      case 'video':
        return 'Video Lecture';
      case 'practice':
        return 'Hands-On Practice';
      case 'revision':
        return 'Concept Revision';
      case 'notes':
        return 'Study Notes';
    }
  };

  if (!activeTracker) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">No Active Study Track</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
          Import any YouTube playlist or course syllabus to generate a structured daily study schedule and task tracker.
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Course Overview & Learner Goal Header (Minimalist bar in Deep Work Mode) */}
      {isDeepWork ? (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Shield className="w-4 h-4" />
              <span>Deep Work Session</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <h1 className="text-base font-bold tracking-tight text-white">
              {activeTracker.title}
            </h1>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              {completedTasksCount}/{totalTasksCount} tasks done
            </span>
          </div>
          {onToggleDeepWork && (
            <button
              type="button"
              onClick={onToggleDeepWork}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Restore Full Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`font-semibold ${getCourseThemeTokens(activeTracker.category).accentText}`}>
                  {activeTracker.category}
                </span>
                <span aria-hidden="true">·</span>
                <span>Instructor: {activeTracker.instructor}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTracker.difficulty} Level</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Daily Target: {activeTracker.dailyMinutesTarget} mins
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                DevTrack: {activeTracker.title}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeTracker.description ||
                  'Check off your daily study tasks below, watch your scheduled lesson, and clear any concept doubts with your AI Professor Mentor.'}
              </p>
            </div>

            {/* Course Completion Bar & Quick Study Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-4 shrink-0">
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Course Mastery</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {courseProgress.completed}/{courseProgress.total} lessons ({courseProgress.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getCourseThemeTokens(activeTracker.category).progressBg} rounded-full transition-all duration-500`}
                    style={{ width: `${courseProgress.percent}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeTracker.sourceUrl && /^https?:\/\//i.test(activeTracker.sourceUrl) && (
                  <a
                    href={activeTracker.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Open the course's main YouTube playlist or video URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Course Playlist</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={onSwitchToCurriculum}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Map className="w-3.5 h-3.5 text-slate-500" />
                  <span>Full Syllabus</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestAlert}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                  title="Test the Web Audio session alert chime"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Test Chime</span>
                </button>
                <button
                  type="button"
                  onClick={handleTriggerCelebrationTest}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                  title="Preview milestone celebration & confetti burst"
                >
                  <PartyPopper className="w-3.5 h-3.5" />
                  <span>Preview Milestone</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Learner Workspace Grid: Left (Daily Task Tracker + Lesson) | Right (Focus Timer + Recap) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column: Daily Task Checklist + Today's Assigned Lesson */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Interactive Daily Study Task Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Today's Study Task Checklist
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Break your learning session into clear, actionable steps and check them off as you go.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                  {completedTasksCount}/{totalTasksCount} completed ({taskCompletionPercent}%)
                </span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                  {(['all', 'todo', 'done'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTaskFilter(f)}
                      className={`px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                        taskFilter === f
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f === 'todo' ? 'To Do' : f === 'done' ? 'Done' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Task List Items */}
            <div className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {taskFilter === 'done'
                    ? 'No completed tasks yet today. Check off your first study task above!'
                    : 'All tasks in this view are complete! Add a custom study task below.'}
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isCustom = task.id.startsWith('custom-') || task.id.startsWith('default-task-');
                  return (
                    <div
                      key={task.id}
                      className="py-3 flex items-start justify-between gap-3 group hover:bg-slate-50/70 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleStudyTask(task)}
                        className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                      >
                        <span className="mt-0.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </span>
                        <div className="space-y-0.5">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{categoryLabel(task.category)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">~{task.estimatedMinutes}m</span>
                            {task.linkedLessonId && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-indigo-600 font-medium">Synced with Roadmap</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Remove custom task"
                          aria-label="Remove custom task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Custom Study Task Form */}
            <form
              onSubmit={handleAddCustomTask}
              className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Add a personal study task (e.g., Dry-run binary search on paper)..."
                className="flex-1 text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newTaskCategory}
                  onChange={e => setNewTaskCategory(e.target.value as StudyTask['category'])}
                  aria-label="Task category"
                  className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="practice">Practice</option>
                  <option value="video">Video</option>
                  <option value="revision">Revision</option>
                  <option value="notes">Notes</option>
                </select>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    value={newTaskMinutes}
                    onChange={e => setNewTaskMinutes(Number(e.target.value))}
                    aria-label="Estimated minutes"
                    className="w-10 font-mono tabular-nums text-slate-900 font-semibold bg-transparent focus:outline-none text-center"
                  />
                  <span className="text-slate-400">m</span>
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            </form>
          </div>

          {/* 2. Today's Assigned Lesson & Study Notes Card */}
          {currentLesson ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Active Curriculum Lesson
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {currentLesson.durationMinutes} mins lecture
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  {currentLesson.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                  <span>Core Concepts:</span>
                  {currentLesson.keyConcepts.map((concept, i) => (
                    <React.Fragment key={i}>
                      <span className="text-slate-800 font-medium">{concept}</span>
                      {i < currentLesson.keyConcepts.length - 1 && <span aria-hidden="true">·</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Practice Task Callout */}
              {currentLesson.practiceTask && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Recommended Hands-On Exercise:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed pl-5">
                    {currentLesson.practiceTask}
                  </p>
                </div>
              )}

              {/* Action Buttons: Watch Video + Ask Professor Mentor + Mark Completed */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={
                    activeTracker.id === 'tracker-dsa-striver' || activeTracker.id === 'tracker-fullstack-mern'
                      ? currentLesson.videoUrl
                      : resolveLessonVideoUrl(
                          activeTracker.sourceUrl,
                          currentLesson.videoUrl,
                          activeTracker.modules
                            .flatMap(m => m.lessons)
                            .findIndex(l => l.id === currentLesson.id) >= 0
                            ? activeTracker.modules
                                .flatMap(m => m.lessons)
                                .findIndex(l => l.id === currentLesson.id)
                            : 0,
                          activeTracker.title,
                          currentLesson.title
                        )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Watch YouTube Lecture</span>
                </a>

                <button
                  type="button"
                  onClick={onSwitchToMentor}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Ask Professor Mentor</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs cursor-pointer sm:ml-auto"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Lesson & Log Streak</span>
                </button>
              </div>

              {/* Study Notes text area */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Quick Lesson Notes & Key Formulas (Saved on completion):
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  placeholder="Jot down what clicked today, dry-run examples, or edge cases to remember..."
                  rows={3}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50/60 text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-900">All Curriculum Lessons Completed!</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                You have finished every scheduled lesson in this track. Practice interview questions with the Concept Mentor or import your next course!
              </p>
            </div>
          )}

          {/* 3. Sequential Playlist Lectures & Direct Video Navigation */}
          {!isDeepWork && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Course Playlist Lectures ({activeTracker.title})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any lesson below to open that specific lecture video or timestamp directly on YouTube.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSwitchToCurriculum}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer self-start sm:self-auto"
                >
                  Open Full Syllabus View &rarr;
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {activeTracker.modules
                  .flatMap(m => m.lessons)
                  .map((lesson, idx) => {
                    const directHref =
                      activeTracker.id === 'tracker-dsa-striver' ||
                      activeTracker.id === 'tracker-fullstack-mern'
                        ? lesson.videoUrl
                        : resolveLessonVideoUrl(
                            activeTracker.sourceUrl,
                            lesson.videoUrl,
                            idx,
                            activeTracker.title,
                            lesson.title
                          );
                    const isCurrent = currentLesson?.id === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={`py-2.5 flex items-center justify-between gap-3 text-xs ${
                          isCurrent ? 'bg-indigo-50/50 -mx-2 px-2 rounded-lg' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleLesson(lesson.id)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                            title={lesson.completed ? 'Mark uncompleted' : 'Mark completed'}
                          >
                            {lesson.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <span
                            className={`truncate font-medium ${
                              lesson.completed
                                ? 'line-through text-slate-400'
                                : isCurrent
                                ? 'font-bold text-indigo-950'
                                : 'text-slate-800'
                            }`}
                          >
                            {lesson.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-400 font-mono tabular-nums hidden sm:inline">
                            {lesson.durationMinutes}m
                          </span>
                          <a
                            href={directHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Watch Lecture {idx + 1}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Right Utility Column (4 cols): Focus Timer & Previous Concept Recap */}
        <div className="lg:col-span-4 space-y-6">
          {/* Focus Session Timer Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Focus Study Timer
              </span>
              <span className="text-xs font-bold font-mono tabular-nums text-indigo-600">
                {totalDailyMinutesStudied}/{targetMinutes}m ({progressPercent}%)
              </span>
            </div>

            {/* Visual Circular Progress Ring */}
            <div className="relative my-3 flex items-center justify-center">
              <svg
                className="w-48 h-48 transform -rotate-90"
                viewBox="0 0 210 210"
                aria-label={`Daily progress: ${progressPercent}%`}
              >
                <circle
                  cx="105"
                  cy="105"
                  r={circleRadius}
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="10"
                />
                <circle
                  cx="105"
                  cy="105"
                  r={circleRadius}
                  fill="transparent"
                  stroke={progressPercent >= 100 ? '#10B981' : '#4F46E5'}
                  strokeWidth="10"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold tracking-tight font-mono tabular-nums text-slate-900">
                  {formatTime(secondsRemaining)}
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-1 font-mono tabular-nums">
                  {isTimerRunning
                    ? 'Focus session active'
                    : progressPercent >= 100
                    ? 'Daily target achieved'
                    : `${targetMinutes}m daily goal`}
                </span>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center gap-2.5 mb-5 w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(!isTimerRunning);
                  setHasStartedSession(true);
                }}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                  isTimerRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-white" />
                    <span>Pause Focus Timer</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{hasStartedSession ? 'Resume Focus Timer' : 'Start Focus Timer'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
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
            <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3.5 w-full justify-center">
              <span>Adjust:</span>
              <button
                type="button"
                onClick={() => setSecondsRemaining(prev => prev + 300)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono tabular-nums cursor-pointer"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => setSecondsRemaining(prev => prev + 900)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono tabular-nums cursor-pointer"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => setSecondsRemaining(activeTracker.dailyMinutesTarget * 60)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono tabular-nums cursor-pointer"
              >
                {activeTracker.dailyMinutesTarget}m
              </button>
            </div>
          </div>

          {/* Previous Lesson Revision Card (Hidden in Deep Work mode) */}
          {!isDeepWork && recentlyCompletedLesson && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Last Completed Lesson</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {recentlyCompletedLesson.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {recentlyCompletedLesson.notes ||
                  'Completed and logged in your roadmap. Use the Concept Mentor to review real-world analogies or test yourself before moving ahead.'}
              </p>
              <button
                type="button"
                onClick={onSwitchToMentor}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>Revise with Professor Mentor</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
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
