import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TodaySession } from './components/TodaySession';
import { CurriculumRoadmap } from './components/CurriculumRoadmap';
import { AIMentorView } from './components/AIMentorView';
import { StudySquadsView } from './components/StudySquadsView';
import { ScheduleAlertsView } from './components/ScheduleAlertsView';
import { CreateTrackerModal } from './components/CreateTrackerModal';
import { Tracker, StudySquad } from './types';
import { PRESET_TRACKERS, INITIAL_SQUADS } from './utils/mockPresets';
import { soundAlert } from './utils/audioAlert';
import {
  resolveDeepWorkToggle,
  calculateCourseProgress,
  completeLessonInTracker,
  sanitizeAndSyncTracker,
  getCurrentUncompletedLesson,
  getCourseThemeTokens,
} from './utils/studyWorkspaceLogic';
import { Bell, Play, X, Flame, Volume2, VolumeX, BookOpen, Clock, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule'>('today');

  // Trackers state with localStorage persistence & automatic stale-curriculum repair
  const [trackers, setTrackers] = useState<Tracker[]>(() => {
    try {
      const saved = localStorage.getItem('devtrack_trackers');
      if (saved) {
        const parsed: Tracker[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => sanitizeAndSyncTracker(t));
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved trackers:', e);
    }
    return PRESET_TRACKERS;
  });

  const [activeTrackerId, setActiveTrackerId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('devtrack_active_tracker_id');
      if (saved) return saved;
    } catch {}
    return PRESET_TRACKERS[0]?.id || '';
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

  // Deep Work distraction-free mode state
  const [isDeepWork, setIsDeepWork] = useState<boolean>(false);

  // Active Scheduled Session In-App Alert banner
  const [scheduledAlertBanner, setScheduledAlertBanner] = useState<string | null>(null);
  const [lastAlertFiredDate, setLastAlertFiredDate] = useState<string>('');

  // Toggle Deep Work mode: hides non-essential views (squads, roadmap, schedule) and focuses on active session
  const handleToggleDeepWork = () => {
    setIsDeepWork(prev => {
      const { isDeepWork: nextDeep, nextTab } = resolveDeepWorkToggle(prev, activeTab);
      if (nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
      return nextDeep;
    });
  };

  // Persist trackers
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_trackers', JSON.stringify(trackers));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [trackers]);

  // Persist active tracker ID
  useEffect(() => {
    try {
      localStorage.setItem('devtrack_active_tracker_id', activeTrackerId);
    } catch {}
  }, [activeTrackerId]);

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

  const activeTracker = React.useMemo(() => {
    const found = trackers.find(t => t.id === activeTrackerId) || trackers[0] || null;
    return found ? sanitizeAndSyncTracker(found) : null;
  }, [trackers, activeTrackerId]);

  const themeTokens = React.useMemo(
    () => getCourseThemeTokens(activeTracker?.category),
    [activeTracker?.category]
  );

  // Synchronize dependent state whenever active course or course URL changes
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
                currentLesson: nextUncompleted?.title || `${activeTracker.title} (Completed)`,
              }
            : m
        ),
      }))
    );
  }, [activeTracker?.id, activeTracker?.sourceUrl, activeTracker?.title]);

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

  // Complete a lesson
  const handleCompleteLesson = (lessonId: string, notes?: string, minutesStudied: number = 45) => {
    setTrackers(prevTrackers =>
      prevTrackers.map(t => (t.id === activeTrackerId ? completeLessonInTracker(t, lessonId, notes) : t))
    );

    // Increment streak
    setStreakDays(prev => prev + 1);

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

  // Update notes for a lesson
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

  // Save new tracker and immediately set as active course
  const handleSaveTracker = (newTracker: Tracker) => {
    const sanitized = sanitizeAndSyncTracker(newTracker);
    setTrackers(prev => [sanitized, ...prev.filter(t => t.id !== sanitized.id)]);
    setActiveTrackerId(sanitized.id);
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
        trackName: activeTracker?.title || 'Computer Science Mastery',
        description: `Custom study cohort joined with code ${code}`,
        inviteCode: code,
        squadGoal: 'Master core concepts and keep daily streak alive',
        totalGoalCompletedPercent: 15,
        members: [
          {
            id: 'member-user',
            name: 'You (Student)',
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
      trackName: track || activeTracker?.title || 'Computer Science',
      description: `Active study squad created by you for peer accountability.`,
      inviteCode: `DEV-${Math.floor(1000 + Math.random() * 9000)}`,
      squadGoal: goal || 'Finish all scheduled lessons on time',
      totalGoalCompletedPercent: 0,
      members: [
        {
          id: 'member-user',
          name: 'You (Student)',
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
                onChange={e => setActiveTrackerId(e.target.value)}
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

            {/* Right Learner Status: Daily Time, Streak & Sound Toggle */}
            <div className="flex items-center gap-4 text-slate-600 ml-auto">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Change daily study reminder time"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono tabular-nums">
                  Study Time: <strong>{activeTracker?.scheduledTime || '20:00'}</strong>
                </span>
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
          />
        )}

        {activeTab === 'curriculum' && activeTracker && (
          <CurriculumRoadmap
            key={activeTracker.id}
            tracker={activeTracker}
            onToggleLesson={handleToggleLesson}
            onUpdateNotes={handleUpdateNotes}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
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
    </div>
  );
}
