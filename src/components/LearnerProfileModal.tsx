import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Briefcase,
  Target,
  Clock,
  Calendar,
  Check,
  User,
  BookOpen,
  CheckCircle2,
  Bookmark,
  Play,
  RotateCcw,
  ExternalLink,
  Plus,
  Layers,
  Award,
} from 'lucide-react';
import {
  LearnerProfile,
  LearnerRole,
  PacingMode,
  Tracker,
  CourseStatusCategory,
  CourseAnalyticsItem,
} from '../types';
import {
  LEARNER_ROLE_OPTIONS,
  PACING_PRESETS,
  applyPacingPresetToProfile,
  computeProfileCourseAnalytics,
} from '../utils/studyWorkspaceLogic';

interface LearnerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: LearnerProfile;
  onSaveProfile: (updatedProfile: LearnerProfile, syncToActiveCourse: boolean) => void;
  trackers?: Tracker[];
  activeTrackerId?: string;
  onSelectTracker?: (trackerId: string) => void;
  onMarkCourseCompleted?: (trackerId: string) => void;
  onResetCourseToPending?: (trackerId: string) => void;
  onOpenCreateCourse?: () => void;
  initialSection?: 'courses' | 'settings';
}

export const LearnerProfileModal: React.FC<LearnerProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  trackers = [],
  activeTrackerId = '',
  onSelectTracker,
  onMarkCourseCompleted,
  onResetCourseToPending,
  onOpenCreateCourse,
  initialSection = 'courses',
}) => {
  const [activeSection, setActiveSection] = useState<'courses' | 'settings'>(initialSection);
  const [courseFilter, setCourseFilter] = useState<'all' | CourseStatusCategory>('in_progress');

  // Profile form state
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState<LearnerRole>(profile.role);
  const [careerObjective, setCareerObjective] = useState(profile.careerObjective);
  const [pacingMode, setPacingMode] = useState<PacingMode>(profile.pacingMode);
  const [dailyMinutes, setDailyMinutes] = useState<number>(profile.dailyMinutesTarget);
  const [preferredTime, setPreferredTime] = useState<string>(profile.preferredTime);
  const [studyDays, setStudyDays] = useState<number[]>(profile.studyDays);
  const [syncToActiveCourse, setSyncToActiveCourse] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      setName(profile.name);
      setRole(profile.role);
      setCareerObjective(profile.careerObjective);
      setPacingMode(profile.pacingMode);
      setDailyMinutes(profile.dailyMinutesTarget);
      setPreferredTime(profile.preferredTime);
      setStudyDays(profile.studyDays);
    }
  }, [isOpen, profile, initialSection]);

  const analytics = useMemo(() => computeProfileCourseAnalytics(trackers), [trackers]);

  const filteredCourses: CourseAnalyticsItem[] = useMemo(() => {
    if (courseFilter === 'completed') return analytics.completedCourses;
    if (courseFilter === 'in_progress') return analytics.inProgressCourses;
    if (courseFilter === 'pending') return analytics.pendingCourses;
    return analytics.allCourses;
  }, [analytics, courseFilter]);

  if (!isOpen) return null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleSelectRole = (selectedRole: LearnerRole) => {
    setRole(selectedRole);
    const opt = LEARNER_ROLE_OPTIONS.find(r => r.role === selectedRole);
    if (opt) {
      setCareerObjective(opt.defaultObjective);
      handleSelectPacing(opt.defaultPacing);
    }
  };

  const handleSelectPacing = (mode: PacingMode) => {
    setPacingMode(mode);
    const preset = PACING_PRESETS.find(p => p.mode === mode);
    if (preset) {
      setDailyMinutes(preset.dailyMinutesTarget);
      setPreferredTime(preset.preferredTime);
      setStudyDays([...preset.studyDays]);
    }
  };

  const toggleDay = (dayIdx: number) => {
    setStudyDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const weeklyHours = Math.max(
    1,
    Math.round(((dailyMinutes * Math.max(1, studyDays.length)) / 60) * 10) / 10
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseUpdated = applyPacingPresetToProfile(profile, pacingMode);
    const finalProfile: LearnerProfile = {
      ...baseUpdated,
      name: name.trim() || 'Alex Rivera',
      role: role.trim() || 'Software Engineer',
      careerObjective:
        careerObjective.trim() || 'Master Scalable System Design & Production Engineering',
      pacingMode,
      dailyMinutesTarget: dailyMinutes,
      preferredTime,
      studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5],
      weeklyHoursGoal: weeklyHours,
    };

    onSaveProfile(finalProfile, syncToActiveCourse);
    onClose();
  };

  const formatCompletionDate = (iso?: string) => {
    if (!iso) return 'Recently completed';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently completed';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 space-y-5 relative max-h-[92vh] overflow-y-auto">
        {/* Top Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-indigo-600">{profile.role}</span>
                <span aria-hidden="true">·</span>
                <span>{profile.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {profile.dailyMinutesTarget}m/day ({profile.weeklyHoursGoal}h/wk)
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Learner Profile &amp; Course Tracking Dashboard
              </h2>
            </div>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSection('courses')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'courses'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Course History &amp; Analytics ({analytics.totalCourses})
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'settings'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Role &amp; Pacing Settings
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Close profile dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================
            SECTION 1: COURSE TRACKING & HISTORY DASHBOARD
        ================================================================ */}
        {activeSection === 'courses' && (
          <div className="space-y-6">
            {/* Career Objective Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="text-slate-500 font-medium">Active Career Objective: </span>
                  <strong className="text-slate-900">{profile.careerObjective}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer self-start sm:self-auto shrink-0"
              >
                Edit Role &amp; Goal
              </button>
            </div>

            {/* Summary Metrics / Stats Cards (3 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Total Courses Added */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Total Courses Added</span>
                  <Layers className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                  {analytics.totalCourses}
                </div>
                <p className="text-[11px] text-slate-500">
                  {analytics.totalLessonsAvailable} total lectures across all learning tracks
                </p>
              </div>

              {/* Card 2: Completed vs. In-Progress vs. Pending */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Completed vs. In-Progress</span>
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700">
                    {analytics.completedCount} Done
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-indigo-600">
                    {analytics.inProgressCount} Active
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-semibold font-mono tabular-nums text-slate-600">
                    {analytics.pendingCount} Saved
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {analytics.overallCompletionPercent}% overall curriculum completion rate
                </p>
              </div>

              {/* Card 3: Overall Learning Hours Logged */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Overall Learning Hours Logged</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                    {analytics.totalHoursLogged} hrs
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    ({analytics.totalMinutesLogged} mins)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Logged across {analytics.totalLessonsCompleted} completed lectures
                </p>
              </div>
            </div>

            {/* Course Status Filter Tabs + Add Course Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCourseFilter('in_progress')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    courseFilter === 'in_progress'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>In Progress ({analytics.inProgressCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    courseFilter === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed ({analytics.completedCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    courseFilter === 'pending'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Pending / Saved ({analytics.pendingCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    courseFilter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Tracks ({analytics.totalCourses})
                </button>
              </div>

              {onOpenCreateCourse && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateCourse();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add / Bookmark Course</span>
                </button>
              )}
            </div>

            {/* Course List for Selected Tab */}
            {filteredCourses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <p className="text-sm font-bold text-slate-800">
                  {courseFilter === 'completed'
                    ? 'No completed courses yet'
                    : courseFilter === 'in_progress'
                    ? 'No courses currently in progress'
                    : 'No pending or bookmarked courses in queue'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {courseFilter === 'completed'
                    ? 'Finish all lessons in an active track or click "Mark 100% Completed" on any course to log it in your completed portfolio.'
                    : courseFilter === 'in_progress'
                    ? 'Start a course from your Pending queue or add a new YouTube playlist to begin tracking your progress.'
                    : 'Add a new YouTube playlist or course link to bookmark it in your learning queue for later.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCourses.map(course => {
                  const isCurrentActive = course.trackerId === activeTrackerId;
                  return (
                    <div
                      key={course.trackerId}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrentActive
                          ? 'border-indigo-300 bg-indigo-50/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Unboxed Course Status & Metadata */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`font-bold ${
                                course.status === 'completed'
                                  ? 'text-emerald-700'
                                  : course.status === 'in_progress'
                                  ? 'text-indigo-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {course.status === 'completed'
                                ? '✓ Completed'
                                : course.status === 'in_progress'
                                ? `● In Progress (${course.progressPercent}% done)`
                                : '○ Pending / Saved in Queue'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-medium text-slate-700">{course.category}</span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-slate-500">{course.instructor}</span>
                            {isCurrentActive && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-semibold text-indigo-700">
                                  Currently Selected on Desk
                                </span>
                              </>
                            )}
                          </div>

                          {/* Course Title */}
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {course.title}
                          </h3>

                          {/* Status-Specific Details: Completion Date, Current Milestone, Study Time */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            {course.status === 'completed' ? (
                              <>
                                <span className="text-emerald-800 font-medium">
                                  Completed on {formatCompletionDate(course.completedAt)}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  Total Study Time:{' '}
                                  <strong>
                                    {course.hoursLogged} hrs ({course.minutesLogged} mins)
                                  </strong>
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  {course.completedLessonsCount}/{course.totalLessonsCount} lectures
                                </span>
                              </>
                            ) : course.status === 'in_progress' ? (
                              <>
                                <span>
                                  Current Milestone:{' '}
                                  <strong className="text-slate-800">
                                    {course.currentLessonTitle}
                                  </strong>
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  Time Logged:{' '}
                                  <strong>
                                    {course.hoursLogged} hrs ({course.minutesLogged} mins)
                                  </strong>{' '}
                                  of {course.estimatedTotalHours} hrs
                                </span>
                              </>
                            ) : (
                              <>
                                <span>
                                  First Lecture:{' '}
                                  <strong className="text-slate-800">
                                    {course.currentLessonTitle}
                                  </strong>
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  Est. Duration:{' '}
                                  <strong>
                                    {course.estimatedTotalHours} hrs ({course.estimatedTotalMinutes}{' '}
                                    mins)
                                  </strong>{' '}
                                  · {course.totalLessonsCount} lectures
                                </span>
                              </>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="pt-1 flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  course.status === 'completed'
                                    ? 'bg-emerald-600'
                                    : course.status === 'in_progress'
                                    ? 'bg-indigo-600'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${course.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                              {course.completedLessonsCount}/{course.totalLessonsCount} (
                              {course.progressPercent}%)
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {onSelectTracker && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTracker(course.trackerId);
                                onClose();
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                course.status === 'pending'
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                  : course.status === 'in_progress'
                                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                              }`}
                            >
                              <Play className="w-3 h-3" />
                              <span>
                                {course.status === 'pending'
                                  ? 'Start Course'
                                  : course.status === 'in_progress'
                                  ? 'Resume Course'
                                  : 'Review Course'}
                              </span>
                            </button>
                          )}

                          {course.status !== 'completed' && onMarkCourseCompleted && (
                            <button
                              type="button"
                              onClick={() => onMarkCourseCompleted(course.trackerId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="Mark all lectures in this course as 100% completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark Completed</span>
                            </button>
                          )}

                          {course.status !== 'pending' && onResetCourseToPending && (
                            <button
                              type="button"
                              onClick={() => onResetCourseToPending(course.trackerId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              title="Reset progress and move back to Pending / Saved queue"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Move to Pending</span>
                            </button>
                          )}

                          {course.sourceUrl && (
                            <a
                              href={course.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                              title="Open source playlist on YouTube"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            SECTION 2: ROLE, CAREER GOAL & PACING SETTINGS
        ================================================================ */}
        {activeSection === 'settings' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Learner Name & Role Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your Name / Display Handle
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Current Role / Learner Category
                </label>
                <select
                  value={role}
                  onChange={e => handleSelectRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 bg-white font-semibold cursor-pointer"
                >
                  {LEARNER_ROLE_OPTIONS.map(opt => (
                    <option key={opt.role} value={opt.role}>
                      {opt.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Role Cards */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                Select Your Primary Learner Persona:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {LEARNER_ROLE_OPTIONS.map(opt => {
                  const isSelected = role === opt.role;
                  return (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => handleSelectRole(opt.role)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-slate-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{opt.role}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {opt.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Career / Upskilling Objective */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Primary Career or Skill Objective
              </label>
              <div className="relative">
                <Target className="w-4 h-4 text-indigo-600 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={careerObjective}
                  onChange={e => setCareerObjective(e.target.value)}
                  placeholder="e.g. Transition to Senior Backend Engineer, Ship AI SaaS, Master System Design"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>

            {/* Flexible Pacing Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Flexible Pacing Mode (After-Office Hours, Weekend Sprints, or Daily Habits)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PACING_PRESETS.map(preset => {
                  const isSelected = pacingMode === preset.mode;
                  return (
                    <button
                      key={preset.mode}
                      type="button"
                      onClick={() => handleSelectPacing(preset.mode)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-slate-900'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{preset.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{preset.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Daily Minutes & Preferred Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Daily Study Target</span>
                  </label>
                  <span className="text-xs font-bold font-mono tabular-nums text-indigo-600">
                    {dailyMinutes}m / day ({weeklyHours}h / wk)
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={180}
                  step={15}
                  value={dailyMinutes}
                  onChange={e => setDailyMinutes(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Preferred Study Session Time
                </label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={e => setPreferredTime(e.target.value)}
                  className="text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-500 ml-2">
                  (24h alert &amp; calendar sync time)
                </span>
              </div>
            </div>

            {/* Active Study Days */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Active Study Days</span>
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {dayLabels.map((label, idx) => {
                  const isSelected = studyDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sync checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncToActiveCourse}
                onChange={e => setSyncToActiveCourse(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Apply this pacing schedule ({dailyMinutes}m/day at {preferredTime}) to my active
                course
              </span>
            </label>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Profile &amp; Goals</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
