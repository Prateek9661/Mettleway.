import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  ExternalLink,
  Bell,
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
  Briefcase,
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Youtube,
  Search,
  Square,
  SlidersHorizontal,
  Coffee,
  History,
  FileText,
  ListVideo,
} from 'lucide-react';
import { Tracker, Lesson, StudyTask, LearnerProfile } from '../types';
import { soundAlert } from '../utils/audioAlert';
import {
  getActiveOrSelectedLesson,
  calculateCourseProgress,
  generateDailyStudyChecklist,
  filterStudyTasks,
  getCourseThemeTokens,
  resolveLessonVideoUrl,
  resolveLessonEmbedUrl,
  computeSkillMilestones,
  createDefaultLearnerProfile,
  computeProfileCourseAnalytics,
  getContinueLearningInfoForTracker,
  FocusTimerPhase,
  FocusTimerSettings,
  FocusSessionRecord,
  createDefaultFocusTimerSettings,
  resolveFocusPhaseDurationSeconds,
  recordCompletedFocusSession,
  computeFocusSessionAnalytics,
  filterCourseLessons,
  getUserScopedStorageKey,
  WorkspaceSideTab,
  formatPlaylistTabLabel,
} from '../utils/studyWorkspaceLogic';
import { ConfettiCelebration } from './ConfettiCelebration';
import { PersonalVideoNotesPanel } from './PersonalVideoNotesPanel';
import { InlineProfessorMentorTab } from './InlineProfessorMentorTab';

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
  learnerProfile?: LearnerProfile;
  onOpenProfileModal?: () => void;
  allTrackers?: Tracker[];
  selectedLessonId?: string | null;
  onSelectLesson?: (lessonId: string) => void;
  onOpenNotesLibrary?: () => void;
  onAddVideoNote?: (params: {
    noteId?: string;
    userId?: string;
    lessonId: string;
    heading?: string;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
    tags?: import('../types').NoteTag[];
  }) => void;
  onUpdateVideoNote?: (params: {
    lessonId: string;
    noteId: string;
    heading?: string;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
    tags?: import('../types').NoteTag[];
  }) => void;
  onDeleteVideoNote?: (lessonId: string, noteId: string) => void;
  onToggleBookmarkVideoNote?: (lessonId: string, noteId: string) => void;
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
  learnerProfile,
  onOpenProfileModal,
  allTrackers,
  selectedLessonId,
  onSelectLesson,
  onOpenNotesLibrary,
  onAddVideoNote,
  onUpdateVideoNote,
  onDeleteVideoNote,
  onToggleBookmarkVideoNote,
}) => {
  const effectiveProfile = React.useMemo(
    () => learnerProfile || createDefaultLearnerProfile('Software Engineer'),
    [learnerProfile]
  );
  const skillMilestones = React.useMemo(
    () => computeSkillMilestones(activeTracker, effectiveProfile, streakDays),
    [activeTracker, effectiveProfile, streakDays]
  );
  const portfolioAnalytics = React.useMemo(
    () =>
      computeProfileCourseAnalytics(
        allTrackers && allTrackers.length > 0
          ? allTrackers
          : activeTracker
          ? [activeTracker]
          : []
      ),
    [allTrackers, activeTracker]
  );

  // Right-Column 3-Tab Panel State: 'notes' (Default Active Tab) | 'mentor' | 'playlist'
  const [activeSideTab, setActiveSideTab] = useState<WorkspaceSideTab>('notes');

  // 1-Line Collapsible Recommended Hands-On Exercise State
  const [isExerciseExpanded, setIsExerciseExpanded] = useState<boolean>(false);

  // Timer & Pomodoro Focus System state
  const defaultMinutes = activeTracker?.dailyMinutesTarget || 60;
  const [focusPhase, setFocusPhase] = useState<FocusTimerPhase>('study');
  const [focusSettings, setFocusSettings] = useState<FocusTimerSettings>(() => {
    try {
      const saved = localStorage.getItem(
        getUserScopedStorageKey(effectiveProfile.userId, 'devtrack_focus_settings')
      );
      if (saved) return JSON.parse(saved);
    } catch {}
    return createDefaultFocusTimerSettings(defaultMinutes);
  });
  const [isCustomizingFocus, setIsCustomizingFocus] = useState<boolean>(false);
  const [focusHistory, setFocusHistory] = useState<FocusSessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(
        getUserScopedStorageKey(effectiveProfile.userId, 'devtrack_focus_history')
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [lastCompletedFocusSummary, setLastCompletedFocusSummary] =
    useState<FocusSessionRecord | null>(null);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-course lesson search & filter state (inside Tab 3: Playlist)
  const [courseLessonSearch, setCourseLessonSearch] = useState<string>('');
  const [courseLessonStatusFilter, setCourseLessonStatusFilter] = useState<
    'all' | 'pending' | 'completed'
  >('all');

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

  // Persist focus settings and focus history per user
  useEffect(() => {
    try {
      localStorage.setItem(
        getUserScopedStorageKey(effectiveProfile.userId, 'devtrack_focus_settings'),
        JSON.stringify(focusSettings)
      );
    } catch {}
  }, [focusSettings, effectiveProfile.userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserScopedStorageKey(effectiveProfile.userId, 'devtrack_focus_history'),
        JSON.stringify(focusHistory)
      );
    } catch {}
  }, [focusHistory, effectiveProfile.userId]);

  // Sync timer, reset session state & load course-specific tasks whenever activeTracker or courseUrl changes
  useEffect(() => {
    if (activeTracker) {
      setFocusPhase('study');
      setSecondsRemaining(activeTracker.dailyMinutesTarget * 60);
      setIsTimerRunning(false);
      setHasStartedSession(false);
      setTaskFilter('all');
      setCourseLessonSearch('');
      setCourseLessonStatusFilter('all');
      setIsExerciseExpanded(false);

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
  }, [
    activeTracker?.id,
    activeTracker?.sourceUrl,
    activeTracker?.title,
    activeTracker?.dailyMinutesTarget,
  ]);

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
      localStorage.setItem(
        `devtrack_builtin_checks_${activeTracker.id}`,
        JSON.stringify(builtInChecks)
      );
    } catch {}
  }, [builtInChecks, activeTracker]);

  const [localSelectedLessonId, setLocalSelectedLessonId] = useState<string | null>(null);
  const [seekTimestampSeconds, setSeekTimestampSeconds] = useState<number>(0);

  useEffect(() => {
    setLocalSelectedLessonId(null);
    setSeekTimestampSeconds(0);
  }, [activeTracker?.id, activeTracker?.sourceUrl]);

  const effectiveSelectedLessonId =
    selectedLessonId !== undefined && selectedLessonId !== null
      ? selectedLessonId
      : localSelectedLessonId || activeTracker?.lastWatchedLessonId || null;

  const handleSelectSpecificLesson = (lessonId: string, seekSeconds: number = 0) => {
    setLocalSelectedLessonId(lessonId);
    setSeekTimestampSeconds(seekSeconds);
    if (onSelectLesson) {
      onSelectLesson(lessonId);
    }
  };

  // Resolve the active or user-selected lesson along with its sequential index & module title
  const {
    lesson: currentLesson,
    lessonIndex: currentLessonIndex,
    moduleTitle: currentModuleTitle,
  } = React.useMemo(
    () => getActiveOrSelectedLesson(activeTracker, effectiveSelectedLessonId),
    [activeTracker, effectiveSelectedLessonId]
  );

  const continueLearningInfo = React.useMemo(
    () => getContinueLearningInfoForTracker(activeTracker),
    [activeTracker]
  );

  const allCourseLessons = React.useMemo(
    () => (activeTracker ? activeTracker.modules.flatMap(m => m.lessons) : []),
    [activeTracker]
  );

  const filteredCourseLessons = React.useMemo(
    () => filterCourseLessons(allCourseLessons, courseLessonSearch, courseLessonStatusFilter),
    [allCourseLessons, courseLessonSearch, courseLessonStatusFilter]
  );

  const focusAnalytics = React.useMemo(
    () =>
      computeFocusSessionAnalytics(
        focusHistory,
        focusSettings.dailyFocusGoalMinutes || activeTracker?.dailyMinutesTarget || 60
      ),
    [focusHistory, focusSettings.dailyFocusGoalMinutes, activeTracker?.dailyMinutesTarget]
  );

  const handleSelectFocusPhase = (nextPhase: FocusTimerPhase) => {
    setIsTimerRunning(false);
    setHasStartedSession(false);
    setFocusPhase(nextPhase);
    setSecondsRemaining(resolveFocusPhaseDurationSeconds(focusSettings, nextPhase));
  };

  const handleStopAndLogFocusSession = () => {
    if (!activeTracker) return;
    setIsTimerRunning(false);
    setHasStartedSession(false);
    const configuredDurationSecs =
      focusPhase === 'study'
        ? (focusSettings.studyMinutes || activeTracker.dailyMinutesTarget || 25) * 60
        : resolveFocusPhaseDurationSeconds(focusSettings, focusPhase);
    const elapsedMinutes = Math.max(
      1,
      Math.round(Math.max(60, configuredDurationSecs - secondsRemaining) / 60)
    );

    const updatedHistory = recordCompletedFocusSession(focusHistory, {
      userId: effectiveProfile.userId,
      courseId: activeTracker.id,
      courseTitle: activeTracker.title,
      lessonId: currentLesson?.id || 'general-session',
      lessonTitle: currentLesson?.title || activeTracker.title,
      phase: focusPhase,
      durationMinutes: elapsedMinutes,
      summaryNote:
        focusPhase === 'study'
          ? `Focused on ${currentLesson?.title || activeTracker.title}`
          : 'Rest & recovery break completed',
    });

    setFocusHistory(updatedHistory);
    setLastCompletedFocusSummary(updatedHistory[0] || null);
    setSecondsRemaining(resolveFocusPhaseDurationSeconds(focusSettings, focusPhase));
    setToastMessage(
      `Focus session logged (${elapsedMinutes}m ${
        focusPhase === 'study' ? 'Study' : 'Break'
      }) — saved to Focus History.`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Overall course progress stats
  const courseProgress = React.useMemo(
    () => calculateCourseProgress(activeTracker),
    [activeTracker]
  );

  // Combined Daily Study Checklist (Curriculum-linked tasks + Custom learner tasks)
  const allDailyTasks: StudyTask[] = React.useMemo(
    () => generateDailyStudyChecklist(currentLesson, builtInChecks, customTasks, ''),
    [currentLesson, builtInChecks, customTasks]
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
  const progressPercent = Math.min(
    100,
    Math.round((totalDailyMinutesStudied / targetMinutes) * 100)
  );

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
    onCompleteLesson(currentLesson.id, '', finalMinutes);
    setCelebrationDetails({
      title: currentLesson.title,
      minutes: finalMinutes,
    });
    setIsCelebrationOpen(true);
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
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          No Active Study Track
        </h2>
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

  const playlistTabLabel = formatPlaylistTabLabel(currentLessonIndex, allCourseLessons.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Top Course Overview Strip (Keeps Video Learning Workspace Above the Fold) */}
      {isDeepWork ? (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Shield className="w-4 h-4" />
              <span>Deep Work Session</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <h1 className="text-sm font-bold tracking-tight text-white">
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
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`font-semibold ${getCourseThemeTokens(activeTracker.category).accentText}`}>
                {activeTracker.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>Instructor: {activeTracker.instructor}</span>
              <span aria-hidden="true">·</span>
              <span>{activeTracker.difficulty} Level</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Briefcase className="w-3 h-3 text-indigo-600" />
                <span>{effectiveProfile.role}</span>
              </span>
              {onOpenProfileModal && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                  >
                    Customize Role &amp; Pacing
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                DevTrack: {activeTracker.title}
              </h1>
              {continueLearningInfo && (
                <button
                  type="button"
                  onClick={() => handleSelectSpecificLesson(continueLearningInfo.lessonId, 0)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-indigo-600" />
                  <span>Resume Lesson {continueLearningInfo.lessonIndex + 1}</span>
                </button>
              )}
            </div>
          </div>

          {/* Course Mastery + Quick Header Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="w-44 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">Course Mastery</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {courseProgress.completed}/{courseProgress.total} ({courseProgress.percent}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getCourseThemeTokens(activeTracker.category).progressBg} rounded-full transition-all duration-500`}
                  style={{ width: `${courseProgress.percent}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeTracker.sourceUrl && /^https?:\/\//i.test(activeTracker.sourceUrl) && (
                <a
                  href={activeTracker.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  title="Open the course's main YouTube playlist or video URL"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Course Playlist</span>
                </a>
              )}
              <button
                type="button"
                onClick={onSwitchToCurriculum}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Map className="w-3 h-3 text-slate-500" />
                <span>Full Syllabus</span>
              </button>
              <button
                type="button"
                onClick={handleTestAlert}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                title="Test the Web Audio session alert chime"
              >
                <Bell className="w-3 h-3" />
                <span>Test Chime</span>
              </button>
              <button
                type="button"
                onClick={handleTriggerCelebrationTest}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                title="Preview milestone celebration & confetti burst"
              >
                <PartyPopper className="w-3 h-3" />
                <span>Preview Milestone</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          ABOVE-THE-FOLD 2-COLUMN SIDE-BY-SIDE VIDEO LEARNING WORKSPACE
          Left Column (60% width on desktop): Video Player + Compact Action Bar + 1-Line Collapsible Exercise
          Right Column (40% width on desktop): 3-Tab Panel ("Live Notes", "Ask Professor Mentor", "Playlist (X/Y)")
         ========================================================================== */}
      {currentLesson ? (
        <div
          id="active-lesson-player-card"
          data-testid="video-learning-workspace"
          className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5"
        >
          {/* Top Compact Bar: Active Lecture Title + Prev/Next Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-indigo-600">
                  Active Lecture ({currentLessonIndex + 1} of {allCourseLessons.length})
                </span>
                {currentModuleTitle && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-slate-500 font-medium truncate max-w-xs">
                      {currentModuleTitle}
                    </span>
                  </>
                )}
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-500 font-mono tabular-nums inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{currentLesson.durationMinutes}m</span>
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {currentLesson.title}
                </h2>
                {currentLesson.keyConcepts.length > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
                    <span aria-hidden="true">·</span>
                    {currentLesson.keyConcepts.map((concept, i) => (
                      <React.Fragment key={i}>
                        <span className="text-slate-700 font-medium">{concept}</span>
                        {i < currentLesson.keyConcepts.length - 1 && (
                          <span aria-hidden="true">·</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sequential Prev / Next Lecture Switcher */}
            {allCourseLessons.length > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={currentLessonIndex <= 0}
                  onClick={() => {
                    const prevLesson = allCourseLessons[currentLessonIndex - 1];
                    if (prevLesson) handleSelectSpecificLesson(prevLesson.id, 0);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  title="Previous Lesson in Playlist"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous Lesson</span>
                </button>
                <button
                  type="button"
                  disabled={currentLessonIndex >= allCourseLessons.length - 1}
                  onClick={() => {
                    const nextLesson = allCourseLessons[currentLessonIndex + 1];
                    if (nextLesson) handleSelectSpecificLesson(nextLesson.id, 0);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  title="Next Lesson in Playlist"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2-Column Side-by-Side Split: 60% Left Column (`3fr`) | 40% Right Column (`2fr`) */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-stretch">
            {/* LEFT COLUMN (60% width on desktop): Video Player + Compact Action Bar + 1-Line Collapsible Exercise */}
            <div
              data-testid="workspace-left-column"
              className="flex flex-col justify-between space-y-3 min-w-0"
            >
              {/* Embedded YouTube Video Player at the Top */}
              {(() => {
                const embedUrl = resolveLessonEmbedUrl(
                  activeTracker.sourceUrl,
                  currentLesson.videoUrl,
                  currentLessonIndex,
                  seekTimestampSeconds
                );
                if (!embedUrl) return null;

                return (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs">
                    <iframe
                      key={`${activeTracker.id}-${currentLesson.id}-${currentLessonIndex}-${seekTimestampSeconds}`}
                      src={embedUrl}
                      title={`YouTube video player for ${currentLesson.title}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                );
              })()}

              {/* Compact Action Bar Directly Below the Video Player */}
              <div
                data-testid="video-compact-action-bar"
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Primary Green Button: "Complete Lesson & Log Streak" */}
                    <button
                      type="button"
                      data-testid="complete-lesson-log-streak-btn"
                      onClick={handleMarkComplete}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Lesson &amp; Log Streak</span>
                    </button>

                    {/* Toggle Completed Status */}
                    <button
                      type="button"
                      onClick={() => onToggleLesson(currentLesson.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        currentLesson.completed
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          currentLesson.completed ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span>
                        {currentLesson.completed ? 'Completed (Undo)' : 'Mark Completed'}
                      </span>
                    </button>
                  </div>

                  {/* "Watch on YouTube" Link */}
                  <a
                    href={
                      activeTracker.id === 'tracker-dsa-striver' ||
                      activeTracker.id === 'tracker-fullstack-mern'
                        ? currentLesson.videoUrl
                        : resolveLessonVideoUrl(
                            activeTracker.sourceUrl,
                            currentLesson.videoUrl,
                            currentLessonIndex,
                            activeTracker.title,
                            currentLesson.title
                          )
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="watch-on-youtube-link"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Youtube className="w-3.5 h-3.5 text-rose-600" />
                    <span>Watch on YouTube</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>

                {/* Concise 1-Line Collapsible Banner for "Recommended Hands-On Exercise" */}
                {currentLesson.practiceTask && (
                  <div
                    data-testid="collapsible-exercise-banner"
                    className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2 text-xs transition-colors"
                  >
                    <button
                      type="button"
                      data-testid="toggle-exercise-banner-btn"
                      onClick={() => setIsExerciseExpanded(prev => !prev)}
                      aria-expanded={isExerciseExpanded}
                      className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-bold text-slate-800 whitespace-nowrap shrink-0">
                          Recommended Hands-On Exercise:
                        </span>
                        <span
                          className={`text-slate-700 ${
                            isExerciseExpanded ? '' : 'truncate'
                          }`}
                        >
                          {currentLesson.practiceTask}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-800 whitespace-nowrap shrink-0">
                        <span>{isExerciseExpanded ? 'Hide' : 'Expand'}</span>
                        {isExerciseExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </button>

                    {isExerciseExpanded && (
                      <div className="mt-2 pt-2 border-t border-amber-200/70 text-slate-700 leading-relaxed flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs">{currentLesson.practiceTask}</p>
                        <button
                          type="button"
                          onClick={() => setActiveSideTab('mentor')}
                          className="text-[11px] font-semibold text-indigo-700 hover:underline cursor-pointer shrink-0"
                        >
                          Ask Professor Mentor for a hint &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (40% width on desktop, matching height of left column):
                Sleek 3-Tab Panel:
                - Tab 1: "Live Notes" (Default Active Tab)
                - Tab 2: "Ask Professor Mentor" (Live AI Doubt Solver)
                - Tab 3: "Playlist (X/Y)" */}
            <div
              data-testid="workspace-right-column"
              className="flex flex-col border border-slate-200 rounded-2xl bg-white p-3 shadow-2xs min-w-0 lg:max-h-[540px]"
            >
              {/* 3-Tab Segmented Switcher Bar */}
              <div
                role="tablist"
                aria-label="Video Learning Workspace Tools"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-2.5 shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSideTab === 'notes'}
                  data-testid="workspace-tab-notes"
                  onClick={() => setActiveSideTab('notes')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeSideTab === 'notes'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Live Notes</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSideTab === 'mentor'}
                  data-testid="workspace-tab-mentor"
                  onClick={() => setActiveSideTab('mentor')}
                  className={`flex-[1.35] flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeSideTab === 'mentor'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span>Ask Professor Mentor</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSideTab === 'playlist'}
                  data-testid="workspace-tab-playlist"
                  onClick={() => setActiveSideTab('playlist')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeSideTab === 'playlist'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListVideo className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono tabular-nums">{playlistTabLabel}</span>
                </button>
              </div>

              {/* TAB 1 CONTENT: "Live Notes" (Unified Note-Taking System) */}
              {activeSideTab === 'notes' && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                  {onAddVideoNote &&
                  onUpdateVideoNote &&
                  onDeleteVideoNote &&
                  onToggleBookmarkVideoNote ? (
                    <PersonalVideoNotesPanel
                      tracker={activeTracker}
                      currentLesson={currentLesson}
                      currentLessonIndex={currentLessonIndex}
                      elapsedSessionSeconds={Math.max(0, targetSeconds - secondsRemaining)}
                      userId={effectiveProfile.userId}
                      onAddNote={onAddVideoNote}
                      onUpdateNote={onUpdateVideoNote}
                      onDeleteNote={onDeleteVideoNote}
                      onToggleBookmarkNote={onToggleBookmarkVideoNote}
                      onOpenNotesLibrary={onOpenNotesLibrary}
                      onSeekToTimestamp={(secs, lessonId) => {
                        handleSelectSpecificLesson(lessonId, secs);
                        setToastMessage(`Jumped video player to timestamp ${formatTime(secs)}.`);
                        setTimeout(() => setToastMessage(null), 2500);
                      }}
                    />
                  ) : null}
                </div>
              )}

              {/* TAB 2 CONTENT: "Ask Professor Mentor" (Inline AI Assistant) */}
              {activeSideTab === 'mentor' && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                  <InlineProfessorMentorTab
                    tracker={activeTracker}
                    currentLesson={currentLesson}
                    currentLessonIndex={currentLessonIndex}
                    onOpenFullMentorView={onSwitchToMentor}
                  />
                </div>
              )}

              {/* TAB 3 CONTENT: "Playlist" (Searchable Course Playlist Lessons List) */}
              {activeSideTab === 'playlist' && (
                <div
                  data-testid="workspace-playlist-panel"
                  className="flex flex-col flex-1 min-h-0 space-y-2.5"
                >
                  <div className="space-y-2 shrink-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        Course Playlist ({courseProgress.completed}/{courseProgress.total} completed)
                      </span>
                      <span className="font-mono tabular-nums text-indigo-600 font-semibold">
                        {courseProgress.percent}% done
                      </span>
                    </div>

                    {/* Search + Status Filter Row */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          data-testid="course-lesson-search-input"
                          value={courseLessonSearch}
                          onChange={e => setCourseLessonSearch(e.target.value)}
                          placeholder="Search lessons or concepts..."
                          aria-label="Search lessons within this course"
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                        />
                      </div>

                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold shrink-0">
                        {(['all', 'pending', 'completed'] as const).map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setCourseLessonStatusFilter(st)}
                            className={`px-2 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                              courseLessonStatusFilter === st
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {st === 'all' ? 'All' : st === 'pending' ? 'Pending' : 'Done'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Course Playlist Lessons List */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 overflow-y-auto flex-1 max-h-[390px]">
                    {filteredCourseLessons.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No lessons match &ldquo;{courseLessonSearch}&rdquo;.
                      </div>
                    ) : (
                      filteredCourseLessons.map(({ lesson: item, originalIndex: idx }) => {
                        const isPlaying = item.id === currentLesson.id;
                        return (
                          <div
                            key={item.id}
                            className={`px-3 py-2.5 flex items-start gap-2.5 text-xs transition-colors ${
                              isPlaying
                                ? 'bg-indigo-50/90 text-indigo-950'
                                : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleLesson(item.id)}
                              className="mt-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                              title={
                                item.completed
                                  ? 'Mark lesson pending'
                                  : 'Mark lesson completed'
                              }
                              aria-label={
                                item.completed
                                  ? `Mark ${item.title} pending`
                                  : `Mark ${item.title} completed`
                              }
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelectSpecificLesson(item.id, 0)}
                              className="flex-1 text-left min-w-0 cursor-pointer space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`font-mono tabular-nums text-[11px] ${
                                    isPlaying
                                      ? 'font-bold text-indigo-600'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {isPlaying ? `▶ Playing #${idx + 1}` : `Lecture #${idx + 1}`}
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                  {item.durationMinutes}m
                                </span>
                              </div>
                              <p
                                className={`line-clamp-2 leading-snug ${
                                  item.completed
                                    ? 'line-through text-slate-400'
                                    : isPlaying
                                    ? 'font-bold text-indigo-950'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {item.title}
                              </p>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-emerald-900">
            All Curriculum Lessons Completed!
          </h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto">
            You have finished every scheduled lesson in this track. Practice interview questions with the Concept Mentor or import your next course!
          </p>
        </div>
      )}

      {/* ==========================================================================
          SECONDARY WORKSPACE ROW:
          Left (Daily Study Task Checklist) | Right (Focus & Pomodoro Timer + Career Milestones)
          Note: Redundant "Quick Lesson Notes", bottom "Course Playlist Lectures", and
          standalone "Last Completed Lesson" card have been completely removed.
         ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Interactive Daily Study Task Checklist */}
        <div className="lg:col-span-7 space-y-6">
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
                  const isCustom =
                    task.id.startsWith('custom-') || task.id.startsWith('default-task-');
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
                                <span className="text-indigo-600 font-medium">
                                  Synced with Roadmap
                                </span>
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
        </div>

        {/* Right Column (5 cols): Focus & Pomodoro Timer + Career Milestones */}
        <div className="lg:col-span-5 space-y-6">
          {/* Focus & Pomodoro Concentration System Card */}
          <div
            data-testid="focus-pomodoro-card"
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center space-y-4"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Focus &amp; Pomodoro Timer</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono tabular-nums text-indigo-600">
                  {totalDailyMinutesStudied + focusAnalytics.todayFocusMinutes}/{targetMinutes}m (
                  {progressPercent}%)
                </span>
                <button
                  type="button"
                  data-testid="toggle-focus-settings-btn"
                  onClick={() => setIsCustomizingFocus(prev => !prev)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Customize study and break durations"
                  aria-label="Customize focus settings"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pomodoro Phase Selector: Study / Short Break / Long Break */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl w-full text-xs font-semibold">
              <button
                type="button"
                data-testid="focus-phase-study-btn"
                onClick={() => handleSelectFocusPhase('study')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  focusPhase === 'study'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pomodoro ({focusSettings.studyMinutes}m)
              </button>
              <button
                type="button"
                data-testid="focus-phase-short-break-btn"
                onClick={() => handleSelectFocusPhase('short_break')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1 ${
                  focusPhase === 'short_break'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coffee className="w-3 h-3" />
                <span>Break ({focusSettings.shortBreakMinutes}m)</span>
              </button>
              <button
                type="button"
                data-testid="focus-phase-long-break-btn"
                onClick={() => handleSelectFocusPhase('long_break')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  focusPhase === 'long_break'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Long ({focusSettings.longBreakMinutes}m)
              </button>
            </div>

            {/* Customizable Study & Break Durations Panel */}
            {isCustomizingFocus && (
              <div
                data-testid="focus-settings-panel"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Customize Focus Durations</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSecs = resolveFocusPhaseDurationSeconds(focusSettings, focusPhase);
                      setSecondsRemaining(nextSecs);
                      setIsCustomizingFocus(false);
                    }}
                    className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                  >
                    Apply &amp; Close
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Study (m)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={focusSettings.studyMinutes}
                      onChange={e => {
                        const val = Math.max(5, Math.min(120, Number(e.target.value) || 25));
                        setFocusSettings(prev => ({ ...prev, studyMinutes: val }));
                        if (focusPhase === 'study' && !isTimerRunning) {
                          setSecondsRemaining(val * 60);
                        }
                      }}
                      aria-label="Study duration minutes"
                      className="w-full px-2 py-1 font-mono tabular-nums font-semibold bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Short Break
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={focusSettings.shortBreakMinutes}
                      onChange={e => {
                        const val = Math.max(1, Math.min(30, Number(e.target.value) || 5));
                        setFocusSettings(prev => ({ ...prev, shortBreakMinutes: val }));
                        if (focusPhase === 'short_break' && !isTimerRunning) {
                          setSecondsRemaining(val * 60);
                        }
                      }}
                      aria-label="Short break duration minutes"
                      className="w-full px-2 py-1 font-mono tabular-nums font-semibold bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Long Break
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={focusSettings.longBreakMinutes}
                      onChange={e => {
                        const val = Math.max(5, Math.min(60, Number(e.target.value) || 15));
                        setFocusSettings(prev => ({ ...prev, longBreakMinutes: val }));
                        if (focusPhase === 'long_break' && !isTimerRunning) {
                          setSecondsRemaining(val * 60);
                        }
                      }}
                      aria-label="Long break duration minutes"
                      className="w-full px-2 py-1 font-mono tabular-nums font-semibold bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visual Circular Progress Ring */}
            <div className="relative my-1 flex items-center justify-center">
              <svg
                className="w-40 h-40 transform -rotate-90"
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
                  stroke={
                    focusPhase !== 'study'
                      ? '#10B981'
                      : progressPercent >= 100
                      ? '#10B981'
                      : '#4F46E5'
                  }
                  strokeWidth="10"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold tracking-tight font-mono tabular-nums text-slate-900">
                  {formatTime(secondsRemaining)}
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-1 font-mono tabular-nums">
                  {isTimerRunning
                    ? focusPhase === 'study'
                      ? 'Focus session active'
                      : 'Recovery break active'
                    : progressPercent >= 100
                    ? 'Daily target achieved'
                    : `${targetMinutes}m daily goal`}
                </span>
              </div>
            </div>

            {/* Timer Controls: Start/Pause/Resume + Stop & Log + Reset */}
            <div className="flex flex-wrap items-center gap-2 w-full justify-center">
              <button
                type="button"
                data-testid="toggle-focus-timer-btn"
                onClick={() => {
                  setIsTimerRunning(!isTimerRunning);
                  setHasStartedSession(true);
                }}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer ${
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
                data-testid="stop-focus-session-btn"
                onClick={handleStopAndLogFocusSession}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Stop timer and log focus session to history"
              >
                <Square className="w-3 h-3 fill-slate-700" />
                <span>Stop &amp; Log</span>
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

            {/* Quick preset increments & Distraction-Free Focus Mode toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3.5 w-full">
              <div className="flex items-center gap-1.5">
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

              {onToggleDeepWork && (
                <button
                  type="button"
                  onClick={onToggleDeepWork}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    isDeepWork
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>{isDeepWork ? 'Exit Focus Mode' : 'Focus Mode'}</span>
                </button>
              )}
            </div>

            {/* Session Completion Summary & Recent Focus Session History */}
            {(lastCompletedFocusSummary || focusAnalytics.recentSessions.length > 0) && (
              <div
                data-testid="focus-session-history-box"
                className="w-full pt-3 border-t border-slate-100 text-left space-y-2"
              >
                {lastCompletedFocusSummary && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-0.5">
                    <div className="font-bold flex items-center justify-between">
                      <span>Session Summary Logged</span>
                      <span className="font-mono tabular-nums">
                        +{lastCompletedFocusSummary.durationMinutes}m
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 truncate">
                      {lastCompletedFocusSummary.lessonTitle}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 text-indigo-600" />
                    <span>Focus History ({focusAnalytics.studySessionsCount} study)</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {focusAnalytics.todayFocusMinutes}m focused today
                  </span>
                </div>

                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {focusAnalytics.recentSessions.slice(0, 3).map(sess => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between text-[11px] px-2 py-1 bg-slate-50 rounded-lg text-slate-700"
                    >
                      <span className="truncate pr-2">
                        {sess.phase === 'study' ? 'Pomodoro:' : 'Break:'} {sess.lessonTitle}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-indigo-600 shrink-0">
                        {sess.durationMinutes}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Career & Skill Development Milestones + Course Portfolio Card (Hidden in Deep Work mode) */}
          {!isDeepWork && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Profile &amp; Career Milestones
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {effectiveProfile.role} · {effectiveProfile.weeklyHoursGoal}h/wk pace
                  </p>
                </div>
                {onOpenProfileModal && (
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Course History &amp; Goals
                  </button>
                )}
              </div>

              {/* Compact Course Portfolio Summary Strip */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Course Portfolio ({portfolioAnalytics.totalCourses} Tracks)
                  </span>
                  <span className="font-mono tabular-nums font-bold text-indigo-600">
                    {portfolioAnalytics.totalHoursLogged} hrs logged
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                  <span className="text-emerald-700 font-semibold">
                    ✓ {portfolioAnalytics.completedCount} Completed
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-600 font-semibold">
                    ● {portfolioAnalytics.inProgressCount} In Progress
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-600 font-semibold">
                    ○ {portfolioAnalytics.pendingCount} Pending
                  </span>
                </div>
                {onOpenProfileModal && (
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="w-full mt-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                  >
                    View Completed, Active &amp; Saved Courses &rarr;
                  </button>
                )}
              </div>

              <div className="space-y-3.5">
                {skillMilestones.map(ms => (
                  <div key={ms.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate pr-2">
                        {ms.title}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {ms.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          ms.completed ? 'bg-emerald-600' : 'bg-indigo-600'
                        } rounded-full transition-all duration-500`}
                        style={{ width: `${ms.progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {ms.targetDescription}
                    </p>
                  </div>
                ))}
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
