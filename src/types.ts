export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  keyConcepts: string[];
  practiceTask?: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
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
  category: 'DSA' | 'Web Development' | 'System Design' | 'Computer Science Core' | 'AI & ML';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  instructor: string;
  sourceUrl: string;
  totalVideos: number;
  estimatedTotalMinutes: number;
  dailyMinutesTarget: number;
  scheduledTime: string; // "19:30" 24h format
  studyDays: number[]; // [1, 2, 3, 4, 5, 6] (0 = Sun, 1 = Mon...)
  createdAt: string;
  modules: Module[];
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


