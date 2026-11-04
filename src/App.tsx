import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TodaySession } from './components/TodaySession';
import { CurriculumRoadmap } from './components/CurriculumRoadmap';
import { AIMentorView } from './components/AIMentorView';
import { StudySquadsView } from './components/StudySquadsView';
import { ScheduleAlertsView } from './components/ScheduleAlertsView';
import { CreateTrackerModal } from './components/CreateTrackerModal';
import { LearnerProfileModal } from './components/LearnerProfileModal';
import { StudentDashboardView } from './components/StudentDashboardView';
import { CourseLibraryView } from './components/CourseLibraryView';
import { Tracker, StudySquad, LearnerProfile, DailyLogEntry } from './types';
import { PRESET_TRACKERS, INITIAL_SQUADS, INITIAL_DAILY_LOGS } from './utils/mockPresets';
import { soundAlert } from './utils/audioAlert';
import {
  NavTab,
  resolveDeepWorkToggle,
  calculateCourseProgress,
  completeLessonInTracker,
  sanitizeAndSyncTracker,
  getCurrentUncompletedLesson,
  getCourseThemeTokens,
  createDefaultLearnerProfile,
  applyProfilePacingToTracker,
  markEntireCourseCompleted,
  resetCourseToPending,
  recordLastWatchedLesson,
  addVideoNoteToTracker,
  updateVideoNoteInTracker,
  deleteVideoNoteFromTracker,
  toggleBookmarkVideoNoteInTracker,
  toggleTrackerFavorite,
  toggleTrackerBookmark,
  deleteTrackerFromList,
  getUserScopedStorageKey,
} from './utils/studyWorkspaceLogic';
import {
  Bell,
  Play,
  X,
  Flame,
  Volume2,
  VolumeX,
  BookOpen,
  Clock,
  CheckCircle2,
  Briefcase,
  Shield,
  Users,
} from 'lucide-react';

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<NavTab>('today');

  // Universal Learner Profile & Goal Pacing state
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>(() => {
    try {
      const saved = localStorage.getItem('devtrack_learner_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role && parsed.pacingMode) {
          return parsed;
        }
      }
    } catch {}
    return createDefaultLearnerProfile('Software Engineer');
  });

  const currentUserId = learnerProfile.userId || 'default-learner';

  // Trackers state with localStorage persistence & automatic stale-curriculum repair
  const [trackers, setTrackers] = useState<Tracker[]>(() => {
    try {
      const saved =
        localStorage.getItem(getUserScopedStorageKey(currentUserId, 'devtrack_trackers')) ||
        localStorage.getItem('devtrack_trackers');
      if (saved) {
        const parsed: Tracker[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitizedList = parsed.map(t => sanitizeAndSyncTracker(t));
          const existingIds = new Set(sanitizedList.map(t => t.id));
          const missingPresets = PRESET_TRACKERS.filter(p => !existingIds.has(p.id));
          return [...sanitizedList, ...missingPresets];
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved trackers:', e);
    }
    return PRESET_TRACKERS;
  });

  const [activeTrackerId, setActiveTrackerId] = useState<string>(() => {
    try {
      const saved =
        localStorage.getItem(
          getUserScopedStorageKey(currentUserId, 'devtrack_active_tracker_id')
        ) || localStorage.getItem('devtrack_active_tracker_id');
      if (saved) return saved;
    } catch {}
    return PRESET_TRACKERS[0]?.id || '';
  });

  // Daily study activity logs state
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(
        getUserScopedStorageKey(currentUserId, 'devtrack_daily_logs')
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_DAILY_LOGS;
  });

  // Squads state with localStorage persistence
  const [squads, setSquads] = useState<StudySquad[]>(() => {
    try {
      const saved = localStorage.getItem('devtrack_squads');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SQUADS;
  });

  const [currentSquadId, setCurrentSquadId] = useState<string>(() => {
    return INITIAL_SQUADS[0]?.id || '';
  });

  // Streak state
  const [streakDays, setStreakDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('devtrack_streak');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 4;
  });

  // Sound mute state
  const [isMuted, setIsMuted] = useState<boolean>(() => soundAlert.isMuted);

  // Create Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Deep Work distraction-free mode state
  const [isDeepWork, setIsDeepWork] = useState<boolean>(false);

  // Active Scheduled Session In-App Alert banner
  const [scheduledAlertBanner, setScheduledAlertBanner] = useState<string | null>(null);
  const [lastAlertFiredDate, setLastAlertFiredDate] = useState<string>('');

  // Toggle Deep Work mode: hides non-essential views and focuses on active session
  const handleToggleDeepWork = () => {
    setIsDeepWork(prev => {
      const { isDeepWork: nextDeep, nextTab } = resolveDeepWorkToggle(prev, activeTab);
      if (nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
      return nextDeep;
    });
  };

  // Persist trackers (both default key and user-scoped key)
  useEffect(() => {
    try {
      const payload = JSON.stringify(trackers);
      localStorage.setItem('devtrack_trackers', payload);
      localStorage.setItem(getUserScopedStorageKey(currentUserId, 'devtrack_trackers'), payload);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [trackers, currentUserId]);

  // Selected lesson ID within the active course (allows clicking any Lesson X in roadmap or playlist queue)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Persist active tracker ID and reset selectedLessonId when switching courses
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_active_tracker_id', activeTrackerId);
      localStorage.setItem(
        getUserScopedStorageKey(currentUserId, 'devtrack_active_tracker_id'),
        activeTrackerId
      );
    } catch {}
  }, [activeTrackerId, currentUserId]);

  // Persist dailyLogs
  useEffect(() => {
    try {
      localStorage.setItem(
        getUserScopedStorageKey(currentUserId, 'devtrack_daily_logs'),
        JSON.stringify(dailyLogs)
      );
    } catch {}
  }, [dailyLogs, currentUserId]);

  // Persist squads
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_squads', JSON.stringify(squads));
    } catch {}
  }, [squads]);

  // Persist streak
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_streak', streakDays.toString());
    } catch {}
  }, [streakDays]);

  // Persist learner profile
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_learner_profile', JSON.stringify(learnerProfile));
    } catch {}
  }, [learnerProfile]);

  // Background synchronization with user account backend store (/api/account/sync)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/account/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          trackers,
          activeTrackerId,
          streakDays,
          dailyLogs,
          learnerProfile,
        }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [currentUserId, trackers, activeTrackerId, streakDays, dailyLogs, learnerProfile]);

  const activeTracker = React.useMemo(() => {
    const found = trackers.find(t => t.id === activeTrackerId) || trackers[0] || null;
    return found ? sanitizeAndSyncTracker(found) : null;
  }, [trackers, activeTrackerId]);

  const themeTokens = React.useMemo(
    () => getCourseThemeTokens(activeTracker?.category),
    [activeTracker?.category]
  );

  // Synchronize dependent state whenever active course, course URL, or learner profile changes
  useEffect(() => {
    if (!activeTracker) return;
    const nextUncompleted = getCurrentUncompletedLesson(activeTracker);
    setSquads(prevSquads =>
      prevSquads.map(sq => ({
        ...sq,
        members: sq.members.map(m =>
          m.isCurrentUser
            ? {
                ...m,
                name: `${learnerProfile.name || 'You'} (${learnerProfile.role})`,
                currentLesson: nextUncompleted?.title || `${activeTracker.title} (Completed)`,
              }
            : m
        ),
      }))
    );
  }, [activeTracker?.id, activeTracker?.sourceUrl, activeTracker?.title, learnerProfile.name, learnerProfile.role]);

  // Save learner profile and optionally sync schedule/pacing to active course
  const handleSaveProfile = (updatedProfile: LearnerProfile, syncToActiveCourse: boolean) => {
    setLearnerProfile(updatedProfile);
    if (syncToActiveCourse && activeTrackerId) {
      setTrackers(prev =>
        prev.map(t => (t.id === activeTrackerId ? applyProfilePacingToTracker(t, updatedProfile) : t))
      );
    }
  };

  // Mark an entire course as 100% completed from Profile Course Analytics
  const handleMarkCourseCompleted = (trackerId: string) => {
    soundAlert.playCompletionChime();
    setTrackers(prev =>
      prev.map(t => (t.id === trackerId ? markEntireCourseCompleted(t) : t))
    );
  };

  // Reset a course back to Pending / Saved (0% progress)
  const handleResetCourseToPending = (trackerId: string) => {
    setTrackers(prev =>
      prev.map(t => (t.id === trackerId ? resetCourseToPending(t) : t))
    );
  };

  // Compute overall active course progress
  const courseStats = React.useMemo(
    () => calculateCourseProgress(activeTracker),
    [activeTracker]
  );

  // Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundAlert.isMuted = next;
  };

  // Background interval: Check if current time matches scheduled time
  useEffect(() => {
    const checkScheduledAlarm = () => {
      if (!activeTracker) return;

      const now = new Date();
      const currentDay = now.getDay();
      if (!activeTracker.studyDays.includes(currentDay)) return;

      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      const [targetHStr, targetMStr] = activeTracker.scheduledTime.split(':');
      const targetHour = parseInt(targetHStr || '20', 10);
      const targetMin = parseInt(targetMStr || '0', 10);

      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${targetHour}:${targetMin}`;

      if (currentHour === targetHour && currentMin === targetMin && lastAlertFiredDate !== todayStr) {
        setLastAlertFiredDate(todayStr);
        soundAlert.playSessionAlertChime();
        soundAlert.fireNotification(`Time for Study: ${activeTracker.title}!`, {
          body: `Your daily ${activeTracker.dailyMinutesTarget}-minute study session is scheduled now. Let's make progress!`,
        });
        setScheduledAlertBanner(`Time to study! Your scheduled session for "${activeTracker.title}" has arrived (${activeTracker.scheduledTime}).`);
      }
    };

    const interval = setInterval(checkScheduledAlarm, 15000);
    return () => clearInterval(interval);
  }, [activeTracker, lastAlertFiredDate]);

  // Select and record last watched lesson for Continue Learning
  const handleSelectAndRecordLesson = (lessonId: string, targetTrackerId?: string) => {
    const effectiveId = targetTrackerId || activeTrackerId;
    setSelectedLessonId(lessonId);
    setTrackers(prev =>
      prev.map(t => (t.id === effectiveId ? recordLastWatchedLesson(t, lessonId) : t))
    );
  };

  // Log daily study activity minutes
  const handleLogDailyStudyActivity = (minutes: number, lessonsIncrement: number = 0) => {
    const todayDate = new Date().toISOString().slice(0, 10);
    setDailyLogs(prev => {
      const existing = prev.find(d => d.date === todayDate);
      if (existing) {
        return prev.map(d =>
          d.date === todayDate
            ? {
                ...d,
                minutesStudied: d.minutesStudied + minutes,
                lessonsCompletedCount: d.lessonsCompletedCount + lessonsIncrement,
              }
            : d
        );
      }
      return [
        ...prev,
        {
          date: todayDate,
          minutesStudied: minutes,
          lessonsCompletedCount: lessonsIncrement,
        },
      ];
    });
  };

  // Complete a lesson
  const handleCompleteLesson = (lessonId: string, notes?: string, minutesStudied: number = 45) => {
    setTrackers(prevTrackers =>
      prevTrackers.map(t => {
        if (t.id !== activeTrackerId) return t;
        const completed = completeLessonInTracker(t, lessonId, notes);
        const nextUncompleted = getCurrentUncompletedLesson(completed);
        return recordLastWatchedLesson(completed, nextUncompleted?.id || lessonId);
      })
    );

    // Increment streak & log daily activity
    setStreakDays(prev => prev + 1);
    handleLogDailyStudyActivity(minutesStudied, 1);

    // Update squad member stats for current user
    setSquads(prevSquads =>
      prevSquads.map(sq => ({
        ...sq,
        members: sq.members.map(m => {
          if (m.isCurrentUser) {
            return {
              ...m,
              streakDays: m.streakDays + 1,
              weeklyMinutes: m.weeklyMinutes + minutesStudied,
              completedToday: true,
            };
          }
          return m;
        }),
      }))
    );
  };

  // Toggle lesson completed/uncompleted
  const handleToggleLesson = (lessonId: string) => {
    setTrackers(prevTrackers =>
      prevTrackers.map(t => {
        if (t.id !== activeTrackerId) return t;
        return {
          ...t,
          lastWatchedLessonId: lessonId,
          lastAccessedAt: new Date().toISOString(),
          modules: t.modules.map(mod => ({
            ...mod,
            lessons: mod.lessons.map(les => {
              if (les.id === lessonId) {
                const nextCompleted = !les.completed;
                if (nextCompleted) soundAlert.playCompletionChime();
                return {
                  ...les,
                  completed: nextCompleted,
                  completedAt: nextCompleted ? new Date().toISOString() : undefined,
                };
              }
              return les;
            }),
          })),
        };
      })
    );
  };

  // Update notes for a lesson (curriculum roadmap compatibility)
  const handleUpdateNotes = (lessonId: string, notes: string) => {
    setTrackers(prevTrackers =>
      prevTrackers.map(t => {
        if (t.id !== activeTrackerId) return t;
        return {
          ...t,
          modules: t.modules.map(mod => ({
            ...mod,
            lessons: mod.lessons.map(les => (les.id === lessonId ? { ...les, notes } : les)),
          })),
        };
      })
    );
  };

  // Structured Personal Video Notes handlers
  const handleAddVideoNote = (params: {
    lessonId: string;
    content: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
  }) => {
    setTrackers(prev =>
      prev.map(t => (t.id === activeTrackerId ? addVideoNoteToTracker(t, params) : t))
    );
  };

  const handleUpdateVideoNote = (params: {
    lessonId: string;
    noteId: string;
    content: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
  }) => {
    setTrackers(prev =>
      prev.map(t => (t.id === activeTrackerId ? updateVideoNoteInTracker(t, params) : t))
    );
  };

  const handleDeleteVideoNote = (lessonId: string, noteId: string) => {
    setTrackers(prev =>
      prev.map(t =>
        t.id === activeTrackerId ? deleteVideoNoteFromTracker(t, lessonId, noteId) : t
      )
    );
  };

  const handleToggleBookmarkVideoNote = (lessonId: string, noteId: string) => {
    setTrackers(prev =>
      prev.map(t =>
        t.id === activeTrackerId ? toggleBookmarkVideoNoteInTracker(t, lessonId, noteId) : t
      )
    );
  };

  // Advanced Course Library handlers
  const handleToggleFavoriteCourse = (trackerId: string) => {
    setTrackers(prev => prev.map(t => (t.id === trackerId ? toggleTrackerFavorite(t) : t)));
  };

  const handleToggleBookmarkCourse = (trackerId: string) => {
    setTrackers(prev => prev.map(t => (t.id === trackerId ? toggleTrackerBookmark(t) : t)));
  };

  const handleRecategorizeCourse = (trackerId: string, newCategory: string) => {
    setTrackers(prev =>
      prev.map(t => (t.id === trackerId ? { ...t, category: newCategory } : t))
    );
  };

  const handleDeleteCourse = (trackerId: string) => {
    setTrackers(prev => {
      const remaining = deleteTrackerFromList(prev, trackerId);
      const nextList = remaining.length > 0 ? remaining : PRESET_TRACKERS;
      if (activeTrackerId === trackerId) {
        setActiveTrackerId(nextList[0]?.id || '');
      }
      return nextList;
    });
  };

  const handleDeleteAllLearningData = () => {
    try {
      localStorage.removeItem('devtrack_trackers');
      localStorage.removeItem('devtrack_active_tracker_id');
      localStorage.removeItem('devtrack_streak');
      localStorage.removeItem('devtrack_daily_logs');
      localStorage.removeItem(getUserScopedStorageKey(currentUserId, 'devtrack_trackers'));
      localStorage.removeItem(getUserScopedStorageKey(currentUserId, 'devtrack_active_tracker_id'));
      localStorage.removeItem(getUserScopedStorageKey(currentUserId, 'devtrack_daily_logs'));
    } catch {}

    fetch('/api/account/data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId }),
    }).catch(() => {});

    const cleanPresets = PRESET_TRACKERS.map(t => resetCourseToPending(t));
    setTrackers(cleanPresets);
    setActiveTrackerId(cleanPresets[0]?.id || '');
    setSelectedLessonId(null);
    setStreakDays(0);
    setDailyLogs([]);
  };

  // Save new tracker and immediately set as active course
  const handleSaveTracker = (newTracker: Tracker) => {
    const sanitized = sanitizeAndSyncTracker({
      ...newTracker,
      lastAccessedAt: new Date().toISOString(),
      lastWatchedLessonId: newTracker.modules[0]?.lessons[0]?.id,
    });
    setTrackers(prev => [sanitized, ...prev.filter(t => t.id !== sanitized.id)]);
    setActiveTrackerId(sanitized.id);
    setSelectedLessonId(sanitized.modules[0]?.lessons[0]?.id || null);
    setActiveTab('today');
  };

  // Update schedule configuration
  const handleUpdateSchedule = (newTime: string, newDuration: number, newDays: number[]) => {
    setTrackers(prev =>
      prev.map(t =>
        t.id === activeTrackerId
          ? {
              ...t,
              scheduledTime: newTime,
              dailyMinutesTarget: newDuration,
              studyDays: newDays,
            }
          : t
      )
    );
  };

  // Send cheer in squad
  const handleSendCheer = (memberId: string) => {
    setSquads(prev =>
      prev.map(sq => {
        if (sq.id !== currentSquadId) return sq;
        return {
          ...sq,
          members: sq.members.map(m => (m.id === memberId ? { ...m, cheerCount: m.cheerCount + 1 } : m)),
        };
      })
    );
  };

  // Nudge teammate
  const handleNudge = (_memberId: string) => {
    // Recorded in feed
  };

  // Join squad
  const handleJoinSquad = (code: string) => {
    const existing = squads.find(s => s.inviteCode.toUpperCase() === code.toUpperCase());
    if (existing) {
      setCurrentSquadId(existing.id);
    } else {
      const newSquad: StudySquad = {
        id: `squad-${Date.now()}`,
        name: `Cohort ${code}`,
        trackName: activeTracker?.title || 'Engineering & Career Upskilling',
        description: `Custom study cohort joined with code ${code}`,
        inviteCode: code,
        squadGoal: 'Master core concepts and keep daily streak alive',
        totalGoalCompletedPercent: 15,
        members: [
          {
            id: 'member-user',
            name: `${learnerProfile.name || 'You'} (${learnerProfile.role})`,
            avatarUrl: '/src/assets/images/avatar_student_alex_1793187697984.jpg',
            streakDays: streakDays,
            weeklyMinutes: 180,
            currentLesson: 'Active Module',
            completedToday: false,
            cheerCount: 0,
            isCurrentUser: true,
          },
        ],
      };
      setSquads(prev => [newSquad, ...prev]);
      setCurrentSquadId(newSquad.id);
    }
  };

  // Create squad
  const handleCreateSquad = (name: string, track: string, goal: string) => {
    const newSquad: StudySquad = {
      id: `squad-${Date.now()}`,
      name,
      trackName: track || activeTracker?.title || 'Continuous Upskilling',
      description: `Active study squad created by you for peer accountability.`,
      inviteCode: `DEV-${Math.floor(1000 + Math.random() * 9000)}`,
      squadGoal: goal || 'Finish all scheduled lessons on time',
      totalGoalCompletedPercent: 0,
      members: [
        {
          id: 'member-user',
          name: `${learnerProfile.name || 'You'} (${learnerProfile.role})`,
          avatarUrl: '/src/assets/images/avatar_student_alex_1793187697984.jpg',
          streakDays: streakDays,
          weeklyMinutes: 120,
          currentLesson: 'Active Session',
          completedToday: false,
          cheerCount: 0,
          isCurrentUser: true,
        },
      ],
    };
    setSquads(prev => [newSquad, ...prev]);
    setCurrentSquadId(newSquad.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Scheduled Alert Floating Banner if fired */}
      {scheduledAlertBanner && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between text-xs sm:text-sm font-medium z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <Bell className="w-4 h-4" />
            <span>{scheduledAlertBanner}</span>
            <button
              onClick={() => {
                setActiveTab('today');
                setScheduledAlertBanner(null);
              }}
              className="ml-3 px-3 py-1 bg-white text-indigo-700 rounded-md font-semibold hover:bg-indigo-50 cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Play className="w-3 h-3 fill-indigo-700" />
              <span>Start Now</span>
            </button>
          </div>
          <button
            onClick={() => setScheduledAlertBanner(null)}
            className="p-1 hover:bg-indigo-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar Navigation (Strict 3-Zone Contract) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        streakDays={streakDays}
        isMuted={isMuted}
        toggleMute={handleToggleMute}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        scheduledTime={activeTracker?.scheduledTime || '20:00'}
        isDeepWork={isDeepWork}
        onToggleDeepWork={handleToggleDeepWork}
      />

      {/* Learner Study Desk Utility Strip (Hidden in Deep Work mode to minimize distractions) */}
      {!isDeepWork && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Active Study Course Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="active-course-select" className="font-semibold text-slate-500 flex items-center gap-1.5">
                <BookOpen className={`w-3.5 h-3.5 ${themeTokens.accentText}`} />
                <span>Active Course:</span>
              </label>
              <select
                id="active-course-select"
                value={activeTracker?.id || ''}
                onChange={e => {
                  const nextId = e.target.value;
                  setActiveTrackerId(nextId);
                  setSelectedLessonId(null);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {trackers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.category})
                  </option>
                ))}
              </select>

              {/* Unboxed Course Progress Metadata */}
              <div className="hidden sm:flex items-center gap-2 text-slate-500 pl-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {courseStats.completed}/{courseStats.total} lessons done ({courseStats.percent}%)
                </span>
              </div>
            </div>

            {/* Right Learner Status: Role & Goals, Squads, Schedule, Deep Work, Streak & Sound Toggle */}
            <div className="flex flex-wrap items-center gap-3.5 text-slate-600 ml-auto">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Open Learner Profile, Course History & Goal Pacing Dashboard"
              >
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                <span>{learnerProfile.role}</span>
                <span className="text-indigo-600 underline underline-offset-2 font-medium hidden lg:inline">
                  (Profile)
                </span>
              </button>

              <span aria-hidden="true" className="text-slate-300">·</span>

              <button
                type="button"
                onClick={() => setActiveTab('squads')}
                className={`flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'squads' ? 'text-indigo-600 font-bold' : ''
                }`}
                title="Open Peer Study Squads"
              >
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Study Squads</span>
              </button>

              <span aria-hidden="true" className="text-slate-300">·</span>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'schedule' ? 'text-indigo-600 font-bold' : ''
                }`}
                title="Change daily study reminder time & ICS calendar sync"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono tabular-nums">
                  Schedule: <strong>{activeTracker?.scheduledTime || '20:00'}</strong>
                </span>
              </button>

              <span aria-hidden="true" className="text-slate-300">·</span>

              <button
                type="button"
                onClick={handleToggleDeepWork}
                className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Enable Deep Work distraction-free focus mode"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Deep Work</span>
              </button>

              <span aria-hidden="true" className="text-slate-300">·</span>

              <div
                className="flex items-center gap-1.5 text-amber-800 font-semibold whitespace-nowrap shrink-0"
                title={`${streakDays} consecutive study days completed`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="font-mono tabular-nums">{streakDays} Day Streak</span>
              </div>

              <span aria-hidden="true" className="text-slate-300">·</span>

              <button
                type="button"
                onClick={handleToggleMute}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title={isMuted ? 'Unmute study chime' : 'Mute study chime'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 pb-16">
        {activeTab === 'today' && (
          <TodaySession
            key={activeTracker?.id || 'no-tracker'}
            activeTracker={activeTracker}
            streakDays={streakDays}
            onCompleteLesson={handleCompleteLesson}
            onToggleLesson={handleToggleLesson}
            onSwitchToMentor={() => setActiveTab('mentor')}
            onSwitchToCurriculum={() => setActiveTab('curriculum')}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            isDeepWork={isDeepWork}
            onToggleDeepWork={handleToggleDeepWork}
            learnerProfile={learnerProfile}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            allTrackers={trackers}
            selectedLessonId={selectedLessonId}
            onSelectLesson={lessonId => handleSelectAndRecordLesson(lessonId)}
            onAddVideoNote={handleAddVideoNote}
            onUpdateVideoNote={handleUpdateVideoNote}
            onDeleteVideoNote={handleDeleteVideoNote}
            onToggleBookmarkVideoNote={handleToggleBookmarkVideoNote}
          />
        )}

        {activeTab === 'dashboard' && (
          <StudentDashboardView
            trackers={trackers}
            activeTrackerId={activeTracker?.id || ''}
            streakDays={streakDays}
            dailyLogs={dailyLogs}
            learnerProfile={learnerProfile}
            onResumeCourseLesson={(trackerId, lessonId) => {
              setActiveTrackerId(trackerId);
              handleSelectAndRecordLesson(lessonId, trackerId);
              setActiveTab('today');
            }}
            onOpenCourseLibrary={() => setActiveTab('library')}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onOpenSyllabus={trackerId => {
              setActiveTrackerId(trackerId);
              setActiveTab('curriculum');
            }}
            onOpenMentor={trackerId => {
              setActiveTrackerId(trackerId);
              setActiveTab('mentor');
            }}
            onLogDailyStudyActivity={mins => handleLogDailyStudyActivity(mins, 0)}
          />
        )}

        {activeTab === 'library' && (
          <CourseLibraryView
            trackers={trackers}
            activeTrackerId={activeTracker?.id || ''}
            onSelectAndResumeCourse={(trackerId, lessonId) => {
              setActiveTrackerId(trackerId);
              if (lessonId) {
                handleSelectAndRecordLesson(lessonId, trackerId);
              }
              setActiveTab('today');
            }}
            onOpenSyllabus={trackerId => {
              setActiveTrackerId(trackerId);
              setActiveTab('curriculum');
            }}
            onToggleFavorite={handleToggleFavoriteCourse}
            onToggleBookmark={handleToggleBookmarkCourse}
            onRecategorizeCourse={handleRecategorizeCourse}
            onDeleteCourse={handleDeleteCourse}
            onDeleteAllLearningData={handleDeleteAllLearningData}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        )}

        {activeTab === 'curriculum' && activeTracker && (
          <CurriculumRoadmap
            key={activeTracker.id}
            tracker={activeTracker}
            onToggleLesson={handleToggleLesson}
            onUpdateNotes={handleUpdateNotes}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onSelectLessonInSession={lessonId => {
              handleSelectAndRecordLesson(lessonId);
              setActiveTab('today');
            }}
          />
        )}

        {activeTab === 'mentor' && activeTracker && (
          <AIMentorView key={activeTracker.id} tracker={activeTracker} streakDays={streakDays} />
        )}

        {activeTab === 'squads' && (
          <StudySquadsView
            squads={squads}
            currentSquadId={currentSquadId}
            onSelectSquad={setCurrentSquadId}
            onSendCheer={handleSendCheer}
            onNudge={handleNudge}
            onJoinSquad={handleJoinSquad}
            onCreateSquad={handleCreateSquad}
          />
        )}

        {activeTab === 'schedule' && activeTracker && (
          <ScheduleAlertsView
            key={activeTracker.id}
            tracker={activeTracker}
            onUpdateSchedule={handleUpdateSchedule}
          />
        )}
      </main>

      {/* Create / Import Tracker Modal */}
      <CreateTrackerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSaveTracker={handleSaveTracker}
      />

      {/* Universal Learner Profile, Course Tracking & Flexible Goal Pacing Modal */}
      <LearnerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={learnerProfile}
        onSaveProfile={handleSaveProfile}
        trackers={trackers}
        activeTrackerId={activeTrackerId}
        onSelectTracker={id => {
          setActiveTrackerId(id);
          setActiveTab('today');
        }}
        onMarkCourseCompleted={handleMarkCourseCompleted}
        onResetCourseToPending={handleResetCourseToPending}
        onOpenCreateCourse={() => setIsCreateModalOpen(true)}
      />
    </div>
  );
}

