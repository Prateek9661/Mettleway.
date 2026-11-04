import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Flame,
  TrendingUp,
  Play,
  Clock,
  Calendar,
  Plus,
  Library,
  Map,
  Bookmark,
  Heart,
  GraduationCap,
} from 'lucide-react';
import { Tracker, DailyLogEntry, LearnerProfile } from '../types';
import {
  computeStudentDashboardSummary,
  getCourseThemeTokens,
  inferCourseTechnologies,
} from '../utils/studyWorkspaceLogic';

interface StudentDashboardViewProps {
  trackers: Tracker[];
  activeTrackerId: string;
  streakDays: number;
  dailyLogs: DailyLogEntry[];
  learnerProfile: LearnerProfile;
  onResumeCourseLesson: (trackerId: string, lessonId: string) => void;
  onOpenCourseLibrary: () => void;
  onOpenCreateModal: () => void;
  onOpenSyllabus: (trackerId: string) => void;
  onOpenMentor: (trackerId: string) => void;
  onLogDailyStudyActivity: (minutes: number) => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  trackers,
  activeTrackerId,
  streakDays,
  dailyLogs,
  learnerProfile,
  onResumeCourseLesson,
  onOpenCourseLibrary,
  onOpenCreateModal,
  onOpenSyllabus,
  onOpenMentor,
  onLogDailyStudyActivity,
}) => {
  const [quickLogMinutes, setQuickLogMinutes] = useState<number>(30);
  const [activityFeedback, setActivityFeedback] = useState<string | null>(null);

  const summary = useMemo(
    () =>
      computeStudentDashboardSummary(
        trackers,
        dailyLogs,
        streakDays,
        learnerProfile.dailyMinutesTarget || 60,
        activeTrackerId
      ),
    [trackers, dailyLogs, streakDays, learnerProfile.dailyMinutesTarget, activeTrackerId]
  );

  const maxWeeklyMinutes = useMemo(() => {
    const highest = Math.max(
      learnerProfile.dailyMinutesTarget || 60,
      ...summary.weeklyActivity.map(d => d.minutesStudied),
      60
    );
    return highest;
  }, [summary.weeklyActivity, learnerProfile.dailyMinutesTarget]);

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.max(5, Math.min(360, Number(quickLogMinutes) || 30));
    onLogDailyStudyActivity(mins);
    setActivityFeedback(`Logged +${mins} minutes to today's weekly learning activity.`);
    setTimeout(() => setActivityFeedback(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Student Dashboard Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-600">{learnerProfile.role}</span>
            <span aria-hidden="true">·</span>
            <span>{learnerProfile.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Target: {learnerProfile.dailyMinutesTarget}m/day ({learnerProfile.weeklyHoursGoal}h/wk)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Learning Dashboard
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Track your enrolled courses, completed and pending lessons, weekly learning activity, and resume directly from your last watched lecture.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCourseLibrary}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Library className="w-4 h-4 text-indigo-600" />
            <span>Browse Course Library ({summary.totalEnrolledCourses})</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Import YouTube Course</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Enrolled Courses */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Total Enrolled Courses</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {summary.totalEnrolledCourses}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{summary.favoriteCoursesCount} Favorites</span>
            <span aria-hidden="true">·</span>
            <span>{summary.bookmarkedNotesCount} Bookmarked Notes</span>
          </div>
        </div>

        {/* KPI 2: Total Completed Lessons */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Total Completed Lessons</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-700">
              {summary.totalCompletedLessons}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              / {summary.totalAvailableLessons} total
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{summary.totalPendingLessons} pending lessons remaining</span>
          </div>
        </div>

        {/* KPI 3: Overall Learning Progress % */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Overall Learning Progress</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {summary.overallProgressPercent}%
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${summary.overallProgressPercent}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Current Learning Streak */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Current Learning Streak</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {summary.currentStreakDays} Days
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{summary.totalWeeklyMinutes} mins studied this week</span>
          </div>
        </div>
      </div>

      {/* Continue Learning Hero Card (Remembers Last Watched Video & Resumes Immediately) */}
      {summary.continueLearning && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-300">
                <span className="font-semibold">Continue Learning</span>
                <span aria-hidden="true">·</span>
                <span>{summary.continueLearning.category}</span>
                <span aria-hidden="true">·</span>
                <span>{summary.continueLearning.instructor}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Lecture {summary.continueLearning.lessonIndex + 1} of{' '}
                  {summary.continueLearning.totalLessons}
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white">
                {summary.continueLearning.trackerTitle}
              </h2>

              <p className="text-xs text-slate-300">
                Next / Last Watched Video:{' '}
                <strong className="text-white">{summary.continueLearning.lessonTitle}</strong> (
                {summary.continueLearning.moduleTitle})
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-slate-300 font-mono tabular-nums">
                <span>
                  {summary.continueLearning.completedLessons} completed ·{' '}
                  {summary.continueLearning.pendingLessons} pending (
                  {summary.continueLearning.progressPercent}%)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
              <div className="w-full sm:w-56 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
                  <span>Course Completion</span>
                  <span className="font-bold text-white">
                    {summary.continueLearning.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${summary.continueLearning.progressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onResumeCourseLesson(
                    summary.continueLearning!.trackerId,
                    summary.continueLearning!.lessonId
                  )
                }
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-900 bg-white hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-slate-900" />
                <span>Resume Lesson {summary.continueLearning.lessonIndex + 1}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Split: Left (Recently Accessed Courses) | Right (Weekly Learning Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Recently Accessed Courses */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recently Accessed Courses</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick up right where you left off across any of your active or saved learning tracks.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCourseLibrary}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Full Library &rarr;
            </button>
          </div>

          {summary.recentlyAccessedCourses.length === 0 ? (
            <div className="p-8 text-center space-y-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm font-bold text-slate-800">No Courses Enrolled Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Import a YouTube playlist or course link to start tracking your completed lessons and progress.
              </p>
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
              >
                Import First Course
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.recentlyAccessedCourses.map(course => {
                const fullTracker = trackers.find(t => t.id === course.trackerId);
                const techs = fullTracker ? inferCourseTechnologies(fullTracker) : [];
                const theme = getCourseThemeTokens(course.category);
                const isActive = course.trackerId === activeTrackerId;

                return (
                  <div
                    key={course.trackerId}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={`font-semibold ${theme.accentText}`}>
                          {course.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{course.instructor}</span>
                        {techs.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{techs.slice(0, 3).join(', ')}</span>
                          </>
                        )}
                        {fullTracker?.isFavorite && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                              <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                              <span>Favorite</span>
                            </span>
                          </>
                        )}
                        {fullTracker?.isBookmarked && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                              <Bookmark className="w-3 h-3 fill-amber-500 text-amber-600" />
                              <span>Bookmarked</span>
                            </span>
                          </>
                        )}
                        {isActive && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-indigo-600 font-semibold">Active Track</span>
                          </>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {course.trackerTitle}
                      </h3>

                      <p className="text-xs text-slate-600 truncate">
                        Resume at Lecture {course.lessonIndex + 1}:{' '}
                        <strong className="text-slate-800">{course.lessonTitle}</strong>
                      </p>

                      {/* Progress Bar + Completed & Pending Counts */}
                      <div className="pt-1 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${theme.progressBg} rounded-full transition-all duration-300`}
                            style={{ width: `${course.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                          {course.completedLessons} done · {course.pendingLessons} pending (
                          {course.progressPercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResumeCourseLesson(course.trackerId, course.lessonId)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Resume Lesson</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenSyllabus(course.trackerId)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        title="Open course syllabus roadmap"
                      >
                        <Map className="w-3.5 h-3.5 text-slate-500" />
                        <span>Syllabus</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenMentor(course.trackerId)}
                        className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                        title="Ask Concept Mentor about this course"
                        aria-label={`Ask Concept Mentor about ${course.trackerTitle}`}
                      >
                        <GraduationCap className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Weekly Learning Activity Chart & Quick Logger */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Weekly Learning Activity</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Last 7 days of study sessions and completed video lectures.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-indigo-600">
              {summary.totalWeeklyMinutes} mins / 7d
            </span>
          </div>

          {/* 7-Day Vertical Bar Chart */}
          <div className="pt-2 pb-1">
            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4 px-1 border-b border-slate-200">
              {summary.weeklyActivity.map(day => {
                const heightPercent =
                  maxWeeklyMinutes > 0
                    ? Math.max(
                        day.minutesStudied > 0 ? 12 : 4,
                        Math.min(100, Math.round((day.minutesStudied / maxWeeklyMinutes) * 100))
                      )
                    : 4;

                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center justify-end h-full gap-1.5 group"
                  >
                    <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-600">
                      {day.minutesStudied}m
                    </span>
                    <div className="w-full max-w-[32px] bg-slate-100 rounded-t-lg h-28 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          day.goalMet
                            ? 'bg-emerald-600'
                            : day.minutesStudied > 0
                            ? 'bg-indigo-600'
                            : 'bg-slate-200'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                        title={`${day.dayLabel} (${day.date}): ${day.minutesStudied} mins studied, ${day.lessonsCompleted} lessons completed`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day Labels Row */}
            <div className="grid grid-cols-7 gap-2 pt-2 text-center">
              {summary.weeklyActivity.map((day, idx) => {
                const isToday = idx === summary.weeklyActivity.length - 1;
                return (
                  <div key={day.date} className="space-y-0.5">
                    <div
                      className={`text-xs font-semibold ${
                        isToday ? 'text-indigo-600 font-bold' : 'text-slate-700'
                      }`}
                    >
                      {day.dayLabel}
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-slate-400">
                      {day.lessonsCompleted} lec
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {activityFeedback && (
            <div
              role="status"
              className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800"
            >
              {activityFeedback}
            </div>
          )}

          {/* Quick Study Activity Logger */}
          <form
            onSubmit={handleQuickLogSubmit}
            className="pt-3 border-t border-slate-100 space-y-2.5"
          >
            <label className="block text-xs font-semibold text-slate-700">
              Log Additional Practice or Revision Time Today:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 flex-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="number"
                  min={5}
                  max={360}
                  step={5}
                  value={quickLogMinutes}
                  onChange={e => setQuickLogMinutes(Number(e.target.value))}
                  aria-label="Study minutes to log"
                  className="w-full font-mono tabular-nums font-semibold text-slate-900 bg-transparent focus:outline-none"
                />
                <span className="text-slate-400 ml-1">mins</span>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                + Log Activity
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
