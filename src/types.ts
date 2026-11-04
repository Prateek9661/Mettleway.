export interface VideoNoteItem {
  id: string;
  lessonId: string;
  trackerId: string;
  content: string;
  timestampSeconds: number;
  formattedTimestamp: string;
  isBookmarked: boolean;
  conceptTag?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  videoId?: string;
  thumbnail?: string;
  playlistPosition?: number;
  keyConcepts: string[];
  practiceTask?: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
  noteItems?: VideoNoteItem[];
}

export interface PlaylistLessonItem {
  videoId: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  playlistPosition: number;
  durationMinutes?: number;
  channelTitle?: string;
}

export interface DiscoveredPlaylistCandidate {
  playlistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  itemCount: number;
  relevanceScore: number;
  matchReasons: string[];
  verifiedContainsVideoId: boolean;
  lessons: PlaylistLessonItem[];
}

export type PlaylistDiscoveryStatus =
  | 'playlist_found'
  | 'multiple_playlists_found'
  | 'no_playlist_found'
  | 'invalid_url'
  | 'error';

export interface PlaylistDiscoveryResult {
  status: PlaylistDiscoveryStatus;
  message: string;
  originalVideoId: string | null;
  explicitPlaylistId: string | null;
  videoMetadata?: {
    videoId: string;
    title: string;
    description?: string;
    channelId: string;
    channelTitle: string;
    thumbnail: string;
    durationMinutes?: number;
    topic: string;
    category: string;
  } | null;
  selectedPlaylist?: DiscoveredPlaylistCandidate | null;
  candidates?: DiscoveredPlaylistCandidate[];
  lessons?: PlaylistLessonItem[];
  errorCode?:
    | 'INVALID_URL'
    | 'PRIVATE_OR_DELETED_VIDEO'
    | 'QUOTA_EXCEEDED'
    | 'NO_PLAYLIST_FOUND'
    | 'API_ERROR';
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Tracker {
  id: string;
  title: string;
  description: string;
  category:
    | 'DSA'
    | 'Web Development'
    | 'System Design'
    | 'Computer Science Core'
    | 'AI & ML'
    | 'DBMS & SQL'
    | 'Operating Systems'
    | 'Computer Networks'
    | 'Object-Oriented Programming'
    | string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  instructor: string;
  sourceUrl: string;
  totalVideos: number;
  estimatedTotalMinutes: number;
  dailyMinutesTarget: number;
  scheduledTime: string; // "19:30" 24h format
  studyDays: number[]; // [1, 2, 3, 4, 5, 6] (0 = Sun, 1 = Mon...)
  createdAt: string;
  modules: Module[];
  isFavorite?: boolean;
  isBookmarked?: boolean;
  technologies?: string[];
  lastWatchedLessonId?: string;
  lastAccessedAt?: string;
  ownerUserId?: string;
}

export interface SquadMember {
  id: string;
  name: string;
  avatarUrl: string;
  streakDays: number;
  weeklyMinutes: number;
  currentLesson: string;
  completedToday: boolean;
  cheerCount: number;
  isCurrentUser?: boolean;
}

export interface StudySquad {
  id: string;
  name: string;
  trackName: string;
  description: string;
  inviteCode: string;
  members: SquadMember[];
  squadGoal: string;
  totalGoalCompletedPercent: number;
}

export interface DailyLogEntry {
  date: string; // YYYY-MM-DD
  minutesStudied: number;
  lessonsCompletedCount: number;
}

export interface StudyTask {
  id: string;
  title: string;
  category: 'video' | 'practice' | 'revision' | 'notes';
  estimatedMinutes: number;
  completed: boolean;
  linkedLessonId?: string;
}

export interface AIRecapData {
  summary: string;
  practicalChallenges: Array<{
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    description: string;
    starterHint: string;
  }>;
  pitfalls: string[];
  mentorAdvice: string;
}

export interface ConceptTutorAnswer {
  directAnswer: string;
  realWorldAnalogy?: string;
  stepByStepBreakdown?: string[];
  complexitySimple?: {
    time: string;
    space: string;
  };
  commonMistake?: string;
  detailedExplanation: string;
  interviewPerspective?: {
    actualInterviewQuestion: string;
    whatInterviewerExpects: string;
    followUpTrap?: string;
  };
  codeExample?: {
    language: string;
    code: string;
    explanation: string;
    lineByLine?: Array<{
      line: string;
      explanation: string;
    }>;
  };
  quickCheckQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export type LearnerRole =
  | 'Software Engineer'
  | 'Working Professional'
  | 'Freelancer & Consultant'
  | 'Career Switcher'
  | 'University Student'
  | 'Lifelong Learner'
  | string;

export type PacingMode =
  | 'after-work'
  | 'weekend-sprint'
  | 'steady-daily'
  | 'intensive-bootcamp'
  | 'exam-prep';

export interface LearnerProfile {
  userId?: string;
  email?: string;
  name: string;
  role: LearnerRole;
  careerObjective: string;
  pacingMode: PacingMode;
  dailyMinutesTarget: number;
  preferredTime: string; // HH:MM 24h format
  studyDays: number[]; // [0..6]
  weeklyHoursGoal: number;
  lastActiveCourseId?: string;
  lastActiveLessonId?: string;
}

export interface SkillMilestone {
  id: string;
  title: string;
  categoryLabel: string;
  progressPercent: number;
  completed: boolean;
  targetDescription: string;
}

export type CourseStatusCategory = 'completed' | 'in_progress' | 'pending';

export interface CourseAnalyticsItem {
  trackerId: string;
  title: string;
  category: string;
  difficulty: string;
  instructor: string;
  sourceUrl: string;
  status: CourseStatusCategory;
  completedLessonsCount: number;
  totalLessonsCount: number;
  progressPercent: number;
  minutesLogged: number;
  estimatedTotalMinutes: number;
  hoursLogged: number;
  estimatedTotalHours: number;
  completedAt?: string;
  currentLessonTitle?: string;
  currentModuleTitle?: string;
  createdAt: string;
}

export interface ProfileCourseAnalyticsSummary {
  totalCourses: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  totalMinutesLogged: number;
  totalHoursLogged: number;
  totalLessonsCompleted: number;
  totalLessonsAvailable: number;
  overallCompletionPercent: number;
  completedCourses: CourseAnalyticsItem[];
  inProgressCourses: CourseAnalyticsItem[];
  pendingCourses: CourseAnalyticsItem[];
  allCourses: CourseAnalyticsItem[];
}

export type CourseSortOption = 'recently_added' | 'completion' | 'title';

export interface CourseLibraryFilterOptions {
  searchQuery?: string;
  category?: string;
  difficulty?: string;
  technology?: string;
  sortBy?: CourseSortOption;
  onlyFavorites?: boolean;
  onlyBookmarked?: boolean;
}

export interface ContinueLearningInfo {
  trackerId: string;
  trackerTitle: string;
  category: string;
  instructor: string;
  lessonId: string;
  lessonTitle: string;
  lessonIndex: number;
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  progressPercent: number;
  moduleTitle: string;
  lastAccessedAt: string;
}

export interface WeeklyActivityDay {
  date: string;
  dayLabel: string;
  minutesStudied: number;
  lessonsCompleted: number;
  targetMinutes: number;
  goalMet: boolean;
}

export interface StudentDashboardSummary {
  totalEnrolledCourses: number;
  totalCompletedLessons: number;
  totalPendingLessons: number;
  totalAvailableLessons: number;
  overallProgressPercent: number;
  currentStreakDays: number;
  continueLearning: ContinueLearningInfo | null;
  recentlyAccessedCourses: ContinueLearningInfo[];
  weeklyActivity: WeeklyActivityDay[];
  totalWeeklyMinutes: number;
  favoriteCoursesCount: number;
  bookmarkedNotesCount: number;
}

