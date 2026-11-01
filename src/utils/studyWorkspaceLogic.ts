import { Tracker, Module, Lesson, StudyTask } from '../types';

export type NavTab = 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule';

export interface CourseThemeTokens {
  accentText: string;
  accentBgSoft: string;
  accentBorder: string;
  progressBg: string;
  buttonBg: string;
}

/**
 * Returns distinct visual theme tokens based on the active course category
 * so switching courses visibly updates the dashboard theme.
 */
export function getCourseThemeTokens(category?: Tracker['category']): CourseThemeTokens {
  const cat = (category || '').toLowerCase();
  if (cat.includes('ai') || cat.includes('ml') || cat.includes('python') || cat.includes('data science')) {
    return {
      accentText: 'text-emerald-700',
      accentBgSoft: 'bg-emerald-50',
      accentBorder: 'border-emerald-200',
      progressBg: 'bg-emerald-600',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
    };
  }
  if (cat.includes('web') || cat.includes('react') || cat.includes('frontend') || cat.includes('full stack')) {
    return {
      accentText: 'text-sky-700',
      accentBgSoft: 'bg-sky-50',
      accentBorder: 'border-sky-200',
      progressBg: 'bg-sky-600',
      buttonBg: 'bg-sky-600 hover:bg-sky-700',
    };
  }
  if (cat.includes('dbms') || cat.includes('database') || cat.includes('sql')) {
    return {
      accentText: 'text-teal-700',
      accentBgSoft: 'bg-teal-50',
      accentBorder: 'border-teal-200',
      progressBg: 'bg-teal-600',
      buttonBg: 'bg-teal-600 hover:bg-teal-700',
    };
  }
  if (cat.includes('system') || cat.includes('cloud') || cat.includes('operating') || cat.includes('network')) {
    return {
      accentText: 'text-amber-700',
      accentBgSoft: 'bg-amber-50',
      accentBorder: 'border-amber-200',
      progressBg: 'bg-amber-600',
      buttonBg: 'bg-amber-600 hover:bg-amber-700',
    };
  }
  if (cat.includes('oop') || cat.includes('java') || cat.includes('c++') || cat.includes('core')) {
    return {
      accentText: 'text-violet-700',
      accentBgSoft: 'bg-violet-50',
      accentBorder: 'border-violet-200',
      progressBg: 'bg-violet-600',
      buttonBg: 'bg-violet-600 hover:bg-violet-700',
    };
  }
  return {
    accentText: 'text-indigo-600',
    accentBgSoft: 'bg-indigo-50',
    accentBorder: 'border-indigo-200',
    progressBg: 'bg-indigo-600',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
  };
}

/**
 * Resolves the state transition when toggling Deep Work mode.
 * When enabling Deep Work from a non-essential view (squads, curriculum, schedule),
 * automatically redirects the learner to the 'today' active study session view.
 */
export function resolveDeepWorkToggle(
  currentDeepWork: boolean,
  currentTab: NavTab
): { isDeepWork: boolean; nextTab: NavTab } {
  const nextDeepWork = !currentDeepWork;
  if (nextDeepWork && currentTab !== 'today' && currentTab !== 'mentor') {
    return { isDeepWork: true, nextTab: 'today' };
  }
  return { isDeepWork: nextDeepWork, nextTab: currentTab };
}

/**
 * Computes overall course mastery statistics (completed, total, percent).
 */
export function calculateCourseProgress(
  tracker: Tracker | null
): { completed: number; total: number; percent: number } {
  if (!tracker) return { completed: 0, total: 0, percent: 0 };
  let total = 0;
  let completed = 0;
  tracker.modules.forEach(mod => {
    mod.lessons.forEach(les => {
      total += 1;
      if (les.completed) completed += 1;
    });
  });
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

/**
 * Returns the first uncompleted lesson in the active tracker, or null if all are completed.
 */
export function getCurrentUncompletedLesson(tracker: Tracker | null): Lesson | null {
  if (!tracker) return null;
  for (const mod of tracker.modules) {
    for (const les of mod.lessons) {
      if (!les.completed) return les;
    }
  }
  return null;
}

/**
 * Generates the combined Daily Study Checklist by pairing curriculum-linked tasks
 * (watching the lecture, completing the hands-on exercise, writing revision notes)
 * with the learner's custom study tasks.
 */
export function generateDailyStudyChecklist(
  currentLesson: Lesson | null,
  builtInChecks: Record<string, boolean>,
  customTasks: StudyTask[],
  sessionNotes: string
): StudyTask[] {
  const coreTasks: StudyTask[] = [];
  if (currentLesson) {
    coreTasks.push({
      id: `lesson-watch-${currentLesson.id}`,
      title: `Watch & complete lesson: "${currentLesson.title}"`,
      category: 'video',
      estimatedMinutes: currentLesson.durationMinutes,
      completed: Boolean(currentLesson.completed),
      linkedLessonId: currentLesson.id,
    });

    if (currentLesson.practiceTask) {
      const key = `practice-${currentLesson.id}`;
      coreTasks.push({
        id: key,
        title: `Hands-on practice: ${currentLesson.practiceTask}`,
        category: 'practice',
        estimatedMinutes: 20,
        completed: Boolean(builtInChecks[key]),
      });
    }

    const notesKey = `notes-${currentLesson.id}`;
    coreTasks.push({
      id: notesKey,
      title: `Write key takeaways or test 1 concept with Professor Mentor`,
      category: 'notes',
      estimatedMinutes: 10,
      completed: Boolean(builtInChecks[notesKey] || sessionNotes.trim().length > 15),
    });
  }
  return [...coreTasks, ...customTasks];
}

/**
 * Filters study tasks by status ('all' | 'todo' | 'done').
 */
export function filterStudyTasks(
  tasks: StudyTask[],
  filter: 'all' | 'todo' | 'done'
): StudyTask[] {
  if (filter === 'todo') return tasks.filter(t => !t.completed);
  if (filter === 'done') return tasks.filter(t => t.completed);
  return tasks;
}

/**
 * Pure state updater that marks a specific lesson completed in a Tracker
 * and attaches the completion timestamp and optional study notes.
 */
export function completeLessonInTracker(
  tracker: Tracker,
  lessonId: string,
  notes?: string,
  completedAtIso: string = new Date().toISOString()
): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id === lessonId) {
          return {
            ...les,
            completed: true,
            completedAt: completedAtIso,
            notes: notes !== undefined && notes.trim() !== '' ? notes : les.notes,
          };
        }
        return les;
      }),
    })),
  };
}

export interface ParsedYouTubeSource {
  isYouTube: boolean;
  videoId: string | null;
  playlistId: string | null;
  startIndex: number;
}

/**
 * Parses a YouTube URL (playlist URL, first-video-of-playlist URL, or single video URL)
 * to extract videoId and playlistId.
 */
export function parseYouTubeSourceUrl(rawUrl: string): ParsedYouTubeSource {
  const trimmed = (rawUrl || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { isYouTube: false, videoId: null, playlistId: null, startIndex: 1 };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
    if (!isYouTube) {
      return { isYouTube: false, videoId: null, playlistId: null, startIndex: 1 };
    }

    const playlistId = parsed.searchParams.get('list') || null;
    let videoId = parsed.searchParams.get('v') || null;

    if (!videoId && host.includes('youtu.be')) {
      const pathSeg = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (pathSeg) videoId = pathSeg;
    }

    if (!videoId && /^\/(embed|live|shorts)\/([^/?]+)/i.test(parsed.pathname)) {
      const m = parsed.pathname.match(/^\/(embed|live|shorts)\/([^/?]+)/i);
      if (m?.[2]) videoId = m[2];
    }

    const idxParam = parseInt(parsed.searchParams.get('index') || '1', 10);
    return {
      isYouTube: true,
      videoId,
      playlistId,
      startIndex: Number.isFinite(idxParam) && idxParam > 0 ? idxParam : 1,
    };
  } catch {
    return { isYouTube: false, videoId: null, playlistId: null, startIndex: 1 };
  }
}

/**
 * Dynamically binds a lesson's videoUrl to its specific lecture in the active course's
 * YouTube playlist (`&index=N` + specific `videoId` if scraped) or specific timestamp (`&t=...s`)
 * for single long-form lecture videos, so clicking Lesson 2 or Lesson 3 navigates directly to that lecture.
 */
export function resolveLessonVideoUrl(
  courseSourceUrl: string,
  lessonVideoUrl?: string,
  lessonIndex: number = 0,
  courseTitle: string = '',
  lessonTitle: string = ''
): string {
  const trimmedSource = (courseSourceUrl || '').trim();
  const isHttpUrl = /^https?:\/\//i.test(trimmedSource);

  // Check if lessonVideoUrl already has a specific scraped videoId for this playlist/index
  const trimmedLessonUrl = (lessonVideoUrl || '').trim();
  const isPlaceholderLessonUrl =
    !trimmedLessonUrl ||
    trimmedLessonUrl.includes('KEs5UyBJ39g') ||
    trimmedLessonUrl.includes('FPu9Uld7W-E') ||
    trimmedLessonUrl.includes('example') ||
    trimmedLessonUrl.includes('watch?v=fake');

  const parsedSource = parseYouTubeSourceUrl(trimmedSource);

  if (isHttpUrl) {
    // Case 1: Course source is a YouTube Playlist or a Video inside a Playlist (has list=...)
    if (parsedSource.isYouTube && parsedSource.playlistId) {
      const targetIndex = lessonIndex + 1;
      // If lessonVideoUrl already has a specific scraped videoId from this same playlist, preserve its v= and set exact index
      if (!isPlaceholderLessonUrl) {
        const parsedLesson = parseYouTubeSourceUrl(trimmedLessonUrl);
        if (parsedLesson.videoId && parsedLesson.playlistId === parsedSource.playlistId) {
          return `https://www.youtube.com/watch?v=${parsedLesson.videoId}&list=${parsedSource.playlistId}&index=${targetIndex}`;
        }
      }

      // If the user provided the first video link of a playlist (watch?v=VID&list=PL...), Lesson 1 uses that videoId + list + index=1
      if (parsedSource.videoId && lessonIndex === 0) {
        return `https://www.youtube.com/watch?v=${parsedSource.videoId}&list=${parsedSource.playlistId}&index=1`;
      }

      const cleanUrl = trimmedSource.replace(/([?&])index=\d+/g, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}index=${targetIndex}`;
    }

    // Case 2: Course source is a single YouTube video (has videoId, no playlistId)
    if (parsedSource.isYouTube && parsedSource.videoId) {
      if (lessonIndex === 0) {
        return trimmedSource;
      }
      // For Lesson 2, Lesson 3, etc. on a single long-form course video, map each lesson to its lecture timestamp (30m = 1800s chapters)
      const timestampSeconds = lessonIndex * 1800;
      const cleanUrl = trimmedSource.replace(/([?&])t=\d+s?/g, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}t=${timestampSeconds}s`;
    }

    // Case 3: Generic playlist URL with list=
    if (trimmedSource.includes('list=')) {
      const cleanUrl = trimmedSource.replace(/([?&])index=\d+/g, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}index=${lessonIndex + 1}`;
    }

    return trimmedSource;
  }

  // If the user typed a topic name instead of a URL, generate a targeted YouTube search link for that specific lesson
  const query = `${courseTitle || trimmedSource} ${lessonTitle}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || 'programming tutorial')}`;
}

export type SubjectKey =
  | 'dbms'
  | 'os'
  | 'cn'
  | 'oop'
  | 'python'
  | 'web'
  | 'ai'
  | 'system'
  | 'dsa'
  | 'custom';

// Known playlist IDs or keywords for popular YouTube courses
const KNOWN_YOUTUBE_PLAYLIST_HINTS: Record<
  string,
  { title: string; instructor: string; topic: SubjectKey; category: string }
> = {
  plxczcowd7aifan6i8cuvibucdjgiokt2y: {
    title: 'DBMS (Database Management Systems) Complete Playlist',
    instructor: 'Gate Smashers',
    topic: 'dbms',
    category: 'DBMS & SQL',
  },
  plbguipm5fzzwbo2ksf32t9x9z6f9n4: {
    title: 'DBMS Complete Course & SQL Mastery',
    instructor: 'Knowledge Gate',
    topic: 'dbms',
    category: 'DBMS & SQL',
  },
  plu0w_9lii9agwh1xjrt242xiphpt2llg: {
    title: 'Python Programming Complete Bootcamp (100 Days of Code)',
    instructor: 'CodeWithHarry',
    topic: 'python',
    category: 'AI & ML',
  },
  _uqrj0tkzlc: {
    title: 'Python Tutorial for Beginners - Full Course',
    instructor: 'Programming with Mosh',
    topic: 'python',
    category: 'AI & ML',
  },
  rfscvs0vtbw: {
    title: 'Learn Python - Full Course for Beginners',
    instructor: 'freeCodeCamp.org',
    topic: 'python',
    category: 'AI & ML',
  },
  hdi2bqojy3c: {
    title: 'JavaScript Crash Course & Modern ES6+',
    instructor: 'Traversy Media',
    topic: 'web',
    category: 'Web Development',
  },
};

function inferCourseMetadata(inputUrl: string, rawTopic?: string, extractedData?: any) {
  const userTopicClean =
    rawTopic && !/^https?:\/\//i.test(rawTopic.trim()) ? rawTopic.trim() : '';
  const combined = `${inputUrl} ${userTopicClean} ${extractedData?.title || ''} ${extractedData?.description || ''}`.toLowerCase();
  const parsedUrl = parseYouTubeSourceUrl(inputUrl);
  const sourceFormatLabel = parsedUrl.playlistId
    ? 'YouTube Playlist Series'
    : parsedUrl.videoId
    ? 'YouTube Video Course'
    : 'Structured Study Series';

  // Check known YouTube playlist/video hints
  for (const [idKey, meta] of Object.entries(KNOWN_YOUTUBE_PLAYLIST_HINTS)) {
    if (combined.includes(idKey.toLowerCase())) {
      return {
        subjectKey: meta.topic,
        defaultTitle: userTopicClean
          ? meta.title.toLowerCase().includes(userTopicClean.toLowerCase())
            ? meta.title
            : `${userTopicClean} — ${meta.title}`
          : meta.title,
        defaultInstructor: meta.instructor,
        category: meta.category,
        defaultDifficulty: 'Comprehensive',
      };
    }
  }

  // DBMS / SQL / Databases
  if (
    /\bdbms\b/i.test(combined) ||
    combined.includes('database') ||
    /\bsql\b/i.test(combined) ||
    combined.includes('mysql') ||
    combined.includes('postgres') ||
    combined.includes('normalization') ||
    combined.includes('relational model')
  ) {
    const label = userTopicClean || 'DBMS & Database Management Systems';
    return {
      subjectKey: 'dbms' as SubjectKey,
      defaultTitle:
        userTopicClean && userTopicClean.length <= 12
          ? `${userTopicClean} (Database Management Systems) Complete Course`
          : label,
      defaultInstructor: `${userTopicClean || 'DBMS'} ${sourceFormatLabel}`,
      category: 'DBMS & SQL',
      defaultDifficulty: 'Beginner to Advanced',
    };
  }

  // Operating Systems (OS)
  if (
    /\bos\b/i.test(combined) ||
    combined.includes('operating system') ||
    combined.includes('deadlock') ||
    combined.includes('cpu scheduling') ||
    combined.includes('virtual memory') ||
    combined.includes('linux kernel')
  ) {
    const label = userTopicClean || 'Operating Systems (OS)';
    return {
      subjectKey: 'os' as SubjectKey,
      defaultTitle:
        userTopicClean && userTopicClean.length <= 6
          ? `${userTopicClean} (Operating Systems) Complete Course`
          : label,
      defaultInstructor: `${userTopicClean || 'Operating Systems'} ${sourceFormatLabel}`,
      category: 'Operating Systems',
      defaultDifficulty: 'Beginner to Advanced',
    };
  }

  // Computer Networks (CN)
  if (
    /\bcn\b/i.test(combined) ||
    combined.includes('computer network') ||
    combined.includes('osi model') ||
    combined.includes('tcp/ip') ||
    combined.includes('subnetting')
  ) {
    const label = userTopicClean || 'Computer Networks (CN)';
    return {
      subjectKey: 'cn' as SubjectKey,
      defaultTitle:
        userTopicClean && userTopicClean.length <= 6
          ? `${userTopicClean} (Computer Networks) Complete Course`
          : label,
      defaultInstructor: `${userTopicClean || 'Computer Networks'} ${sourceFormatLabel}`,
      category: 'Computer Networks',
      defaultDifficulty: 'Beginner to Advanced',
    };
  }

  // Object-Oriented Programming / Java / C++
  if (
    /\boop\b/i.test(combined) ||
    /\boops\b/i.test(combined) ||
    combined.includes('object oriented') ||
    /\bjava\b/i.test(combined) ||
    combined.includes('c++') ||
    /\bcpp\b/i.test(combined)
  ) {
    const label = userTopicClean || 'Object-Oriented Programming & Core Language';
    return {
      subjectKey: 'oop' as SubjectKey,
      defaultTitle: label.length <= 10 ? `${label} Complete Mastery Course` : label,
      defaultInstructor: `${label} ${sourceFormatLabel}`,
      category: 'Object-Oriented Programming',
      defaultDifficulty: 'Beginner to Intermediate',
    };
  }

  // Python
  if (
    combined.includes('python') ||
    combined.includes('django') ||
    combined.includes('flask') ||
    combined.includes('fastapi') ||
    combined.includes('pandas')
  ) {
    return {
      subjectKey: 'python' as SubjectKey,
      defaultTitle: userTopicClean || 'Python Programming & Automation Mastery',
      defaultInstructor: `${userTopicClean || 'Python'} ${sourceFormatLabel}`,
      category: 'AI & ML',
      defaultDifficulty: 'Beginner to Intermediate',
    };
  }

  // AI & Machine Learning
  if (
    combined.includes('machine learning') ||
    combined.includes('deep learning') ||
    combined.includes('neural') ||
    combined.includes('llm') ||
    /\bai\b/i.test(combined) ||
    combined.includes('data science')
  ) {
    return {
      subjectKey: 'ai' as SubjectKey,
      defaultTitle: userTopicClean || 'Applied Machine Learning & AI Engineering',
      defaultInstructor: `${userTopicClean || 'AI & ML'} ${sourceFormatLabel}`,
      category: 'AI & ML',
      defaultDifficulty: 'Intermediate',
    };
  }

  // Web Development
  if (
    combined.includes('react') ||
    combined.includes('javascript') ||
    combined.includes('typescript') ||
    combined.includes('next') ||
    combined.includes('node') ||
    combined.includes('mern') ||
    combined.includes('web') ||
    combined.includes('frontend') ||
    combined.includes('html') ||
    combined.includes('css')
  ) {
    return {
      subjectKey: 'web' as SubjectKey,
      defaultTitle: userTopicClean || 'Modern Full-Stack Web Development Track',
      defaultInstructor: `${userTopicClean || 'Full-Stack Web'} ${sourceFormatLabel}`,
      category: 'Web Development',
      defaultDifficulty: 'Beginner to Intermediate',
    };
  }

  // System Design & Cloud
  if (
    combined.includes('system design') ||
    combined.includes('microservice') ||
    combined.includes('distributed') ||
    combined.includes('docker') ||
    combined.includes('kubernetes') ||
    combined.includes('aws') ||
    combined.includes('devops')
  ) {
    return {
      subjectKey: 'system' as SubjectKey,
      defaultTitle: userTopicClean || 'Scalable System Design & Cloud Architecture',
      defaultInstructor: `${userTopicClean || 'System Design'} ${sourceFormatLabel}`,
      category: 'System Design',
      defaultDifficulty: 'Intermediate to Advanced',
    };
  }

  // DSA
  if (
    combined.includes('dsa') ||
    combined.includes('algorithm') ||
    combined.includes('striver') ||
    combined.includes('leetcode') ||
    combined.includes('data structure')
  ) {
    return {
      subjectKey: 'dsa' as SubjectKey,
      defaultTitle: userTopicClean || 'Data Structures & Algorithms Problem Solving',
      defaultInstructor: `${userTopicClean || 'DSA'} ${sourceFormatLabel}`,
      category: 'DSA',
      defaultDifficulty: 'Intermediate',
    };
  }

  // Dynamic Custom Subject (never falls back to static "Computer Science & Software Engineering Track / YouTube Curated Series")
  const dynamicSubject =
    userTopicClean ||
    (extractedData?.title && !/^https?:\/\//i.test(extractedData.title.trim())
      ? extractedData.title.trim()
      : 'Custom Engineering Subject');

  return {
    subjectKey: 'custom' as SubjectKey,
    defaultTitle: dynamicSubject,
    defaultInstructor: `${dynamicSubject} ${sourceFormatLabel}`,
    category: dynamicSubject.length <= 28 ? dynamicSubject : 'Software Engineering',
    defaultDifficulty: 'Comprehensive',
  };
}

function buildCuratedModulesForSubject(
  subjectKey: SubjectKey,
  courseTitle: string
): Array<{
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    durationMinutes: number;
    keyConcepts: string[];
    practiceTask: string;
  }>;
}> {
  if (subjectKey === 'dbms') {
    return [
      {
        title: 'Module 1: DBMS Architecture, ER Modeling & Relational Foundations',
        description: 'File systems vs DBMS, 3-schema architecture, Entity-Relationship diagrams, and relational keys.',
        lessons: [
          {
            title: 'Lesson 1: Introduction to DBMS, File System vs DBMS & 3-Tier Schema Architecture',
            durationMinutes: 35,
            keyConcepts: ['Physical vs Logical Independence', '3-Schema Architecture', 'DBA Role & DBMS Internals'],
            practiceTask: 'Draw the 3-level ANSI-SPARC architecture and trace how a query maps from view level to physical storage',
          },
          {
            title: 'Lesson 2: Entity-Relationship (ER) Model, Attributes & Relational Keys',
            durationMinutes: 40,
            keyConcepts: ['Super, Candidate, Primary & Foreign Keys', 'Strong vs Weak Entities', 'Cardinality Ratios (1:1, 1:N, M:N)'],
            practiceTask: 'Design a complete ER diagram for a University Course Enrollment system and convert ER tables into relational schemas',
          },
          {
            title: 'Lesson 3: Relational Model, Integrity Constraints & Relational Algebra Operations',
            durationMinutes: 45,
            keyConcepts: ['Referential Integrity', 'Selection (σ) & Projection (π)', 'Natural Join vs Outer Joins', 'Division Operator'],
            practiceTask: 'Write relational algebra expressions for 5 complex multi-table queries before writing SQL',
          },
        ],
      },
      {
        title: 'Module 2: SQL Query Mastery & Database Normalization (1NF to BCNF)',
        description: 'Master SQL joins, subqueries, functional dependencies, and normal forms to eliminate redundancy.',
        lessons: [
          {
            title: 'Lesson 4: Structured Query Language (SQL) — DDL, DML, Joins, GROUP BY & Subqueries',
            durationMinutes: 50,
            keyConcepts: ['INNER, LEFT, RIGHT & FULL Joins', 'GROUP BY & HAVING', 'Correlated Subqueries', 'Window Functions'],
            practiceTask: 'Write SQL queries to find the Nth highest salary and department-wise top earners using both subqueries and window functions',
          },
          {
            title: 'Lesson 5: Functional Dependencies, Armstrong Axioms & Attribute Closure',
            durationMinutes: 40,
            keyConcepts: ['Trivial vs Non-Trivial FD', 'Attribute Closure (X+)', 'Canonical Cover', 'Lossless Join Decomposition'],
            practiceTask: 'Compute attribute closures to find all candidate keys of a given relation R(A,B,C,D,E)',
          },
          {
            title: 'Lesson 6: Database Normalization — 1NF, 2NF, 3NF & Boyce-Codd Normal Form (BCNF)',
            durationMinutes: 45,
            keyConcepts: ['Insertion/Deletion/Update Anomalies', 'Partial Dependency (2NF)', 'Transitive Dependency (3NF)', 'BCNF Decomposition'],
            practiceTask: 'Normalize an unnormalized e-commerce order table step-by-step from 1NF through BCNF',
          },
        ],
      },
      {
        title: 'Module 3: Transactions, Concurrency Control & B+ Tree Indexing',
        description: 'ACID properties, conflict serializability, two-phase locking (2PL), and database indexing.',
        lessons: [
          {
            title: 'Lesson 7: Transactions, ACID Properties, Schedules & Conflict Serializability',
            durationMinutes: 45,
            keyConcepts: ['Atomicity, Consistency, Isolation, Durability', 'Read-Write Conflicts', 'Precedence Graph', 'Two-Phase Locking (2PL)'],
            practiceTask: 'Construct a precedence graph for a 3-transaction schedule to test whether it is conflict serializable',
          },
          {
            title: 'Lesson 8: Database Indexing, B-Trees, B+ Trees & Query Optimization',
            durationMinutes: 40,
            keyConcepts: ['Clustered vs Non-Clustered Index', 'B+ Tree Leaf Linked List', 'Hash Indexing', 'EXPLAIN Query Plan'],
            practiceTask: 'Compare query execution times with and without composite B+ Tree indexes on a sample table',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'os') {
    return [
      {
        title: 'Module 1: Operating System Structure, Processes & CPU Scheduling',
        description: 'Kernel modes, system calls, process control blocks (PCB), and scheduling algorithms.',
        lessons: [
          {
            title: 'Lesson 1: OS Architecture, Kernel vs User Mode & System Calls',
            durationMinutes: 35,
            keyConcepts: ['Monolithic vs Microkernel', 'System Calls (fork, exec, wait)', 'Context Switching'],
            practiceTask: 'Trace the lifecycle of a process creation using fork() and exec() system calls',
          },
          {
            title: 'Lesson 2: Process States, PCB, Threads & Multithreading Models',
            durationMinutes: 40,
            keyConcepts: ['5-State Process Model', 'Process Control Block (PCB)', 'User vs Kernel Threads'],
            practiceTask: 'Compare memory layout shared between threads vs isolated processes',
          },
          {
            title: 'Lesson 3: CPU Scheduling — FCFS, SJF, SRTF, Round Robin & Priority',
            durationMinutes: 45,
            keyConcepts: ['Turnaround Time & Waiting Time', 'Convoy Effect', 'Time Quantum in Round Robin', 'Starvation & Aging'],
            practiceTask: 'Draw Gantt charts and compute average waiting time for 5 processes under SRTF and Round Robin',
          },
        ],
      },
      {
        title: 'Module 2: Process Synchronization, Semaphores, Deadlocks & Virtual Memory',
        description: 'Critical section problem, mutexes, Banker algorithm, paging, and page replacement.',
        lessons: [
          {
            title: 'Lesson 4: Process Synchronization, Critical Section, Mutex & Semaphores',
            durationMinutes: 45,
            keyConcepts: ['Race Condition', 'Mutual Exclusion', 'Counting vs Binary Semaphores', 'Producer-Consumer Problem'],
            practiceTask: 'Write pseudocode using semaphores to solve the bounded-buffer Producer-Consumer problem without deadlock',
          },
          {
            title: 'Lesson 5: Deadlock Conditions, Resource Allocation Graph & Banker’s Algorithm',
            durationMinutes: 40,
            keyConcepts: ['Coffman 4 Conditions', 'Safe State Sequence', 'Deadlock Avoidance vs Prevention'],
            practiceTask: 'Run Banker’s Algorithm on a 5-process, 3-resource matrix to determine the safe execution sequence',
          },
          {
            title: 'Lesson 6: Virtual Memory, Paging, TLB & Page Replacement (LRU, Optimal, FIFO)',
            durationMinutes: 45,
            keyConcepts: ['Page Table & TLB Hit Ratio', 'Page Fault Service Time', 'Belady Anomaly', 'LRU Page Replacement'],
            practiceTask: 'Calculate page fault counts for a reference string across FIFO, Optimal, and LRU replacement policies',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'cn') {
    return [
      {
        title: 'Module 1: OSI & TCP/IP Reference Models, Data Link & Network Layers',
        description: 'Packet encapsulation, framing, error detection, IPv4 subnetting, and routing protocols.',
        lessons: [
          {
            title: 'Lesson 1: OSI 7-Layer Model vs TCP/IP Suite & Packet Encapsulation',
            durationMinutes: 35,
            keyConcepts: ['7 Layers of OSI', 'PDUs (Frames, Packets, Segments)', 'End-to-End vs Hop-by-Hop'],
            practiceTask: 'Trace every header added and stripped when a browser sends an HTTPS request to a web server',
          },
          {
            title: 'Lesson 2: Data Link Layer — Framing, CRC Error Detection, CSMA/CD & ARP',
            durationMinutes: 40,
            keyConcepts: ['Cyclic Redundancy Check (CRC)', 'Sliding Window (Go-Back-N, Selective Repeat)', 'ARP Resolution'],
            practiceTask: 'Compute the transmitted CRC codeword for a binary data frame and generator polynomial',
          },
          {
            title: 'Lesson 3: Network Layer — IPv4 Addressing, CIDR Subnetting & Routing (Dijkstra / BGP)',
            durationMinutes: 45,
            keyConcepts: ['CIDR Subnet Masks', 'NAT & DHCP', 'Distance Vector vs Link State Routing'],
            practiceTask: 'Design 4 variable-length subnets (VLSM) from a /24 CIDR block and list network/broadcast addresses',
          },
        ],
      },
      {
        title: 'Module 2: Transport Layer (TCP/UDP) & Application Layer Protocols',
        description: 'TCP 3-way handshake, congestion control, DNS resolution, and HTTP/TLS.',
        lessons: [
          {
            title: 'Lesson 4: Transport Layer — TCP 3-Way Handshake, Flow Control & Congestion Control',
            durationMinutes: 45,
            keyConcepts: ['SYN, SYN-ACK, ACK', 'Slow Start & AIMD', 'TCP vs UDP Trade-offs'],
            practiceTask: 'Diagram the TCP 3-way connection setup and 4-way connection termination with sequence numbers',
          },
          {
            title: 'Lesson 5: Application Layer — DNS Hierarchy, HTTP/1.1 vs HTTP/2/3 & TLS Handshake',
            durationMinutes: 40,
            keyConcepts: ['Recursive vs Iterative DNS', 'HTTP Statelessness & Cookies', 'Asymmetric + Symmetric TLS'],
            practiceTask: 'Inspect live DNS and HTTPS handshake timings in browser DevTools Network tab',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'oop') {
    return [
      {
        title: 'Module 1: Classes, Objects, Encapsulation & Memory Lifecycle',
        description: 'Constructors, access modifiers, static members, and stack vs heap allocation.',
        lessons: [
          {
            title: 'Lesson 1: Classes, Objects, Constructors & Stack vs Heap Memory Model',
            durationMinutes: 35,
            keyConcepts: ['Class Blueprint vs Object Instance', 'Parameterized & Copy Constructors', 'this Pointer / Reference'],
            practiceTask: 'Implement a complete class with overloaded constructors and trace object references in memory',
          },
          {
            title: 'Lesson 2: Encapsulation, Access Modifiers & Data Hiding',
            durationMinutes: 40,
            keyConcepts: ['Private, Protected, Public', 'Getters & Setters Validation', 'Immutability'],
            practiceTask: 'Refactor a struct with exposed fields into a strictly encapsulated class with invariant checks',
          },
          {
            title: 'Lesson 3: Inheritance, Method Overriding & Runtime Polymorphism',
            durationMinutes: 45,
            keyConcepts: ['Compile-Time vs Runtime Polymorphism', 'Virtual Functions / Dynamic Dispatch', 'super / Base Keyword'],
            practiceTask: 'Build a polymorphic PaymentProcessor hierarchy supporting UPI, Card, and Wallet implementations',
          },
        ],
      },
      {
        title: 'Module 2: Abstraction, Interfaces, Exception Handling & SOLID Principles',
        description: 'Abstract classes vs interfaces, generic programming, and clean OOP design.',
        lessons: [
          {
            title: 'Lesson 4: Abstract Classes vs Interfaces & Composition over Inheritance',
            durationMinutes: 40,
            keyConcepts: ['Pure Virtual / Interface Contracts', 'Loose Coupling', 'Dependency Injection'],
            practiceTask: 'Design a pluggable notification service using interfaces and constructor dependency injection',
          },
          {
            title: 'Lesson 5: Generics / Templates, Collections & SOLID Design Principles',
            durationMinutes: 45,
            keyConcepts: ['Single Responsibility', 'Open-Closed Principle', 'Liskov Substitution', 'Type-Safe Generics'],
            practiceTask: 'Implement a generic LRU Cache class using OOP principles',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'python') {
    return [
      {
        title: 'Module 1: Python Core Syntax, Variables & Control Flow',
        description: 'Master Python execution model, dynamic typing, string slicing, and conditional loops.',
        lessons: [
          {
            title: 'Lesson 1: Python Environment Setup, Variables & Memory Model',
            durationMinutes: 35,
            keyConcepts: ['Dynamic Typing', 'Reference Counting', 'f-Strings', 'Type Casting'],
            practiceTask: 'Write a CLI expense calculator script using formatted f-strings and user input validation',
          },
          {
            title: 'Lesson 2: Control Flow, Loops & List Comprehensions in Python',
            durationMinutes: 40,
            keyConcepts: ['for/while Loops', 'enumerate & zip', 'List Comprehensions', 'Time Efficiency'],
            practiceTask: 'Transform nested loops into clean single-line Python list and dictionary comprehensions',
          },
          {
            title: 'Lesson 3: Python Data Structures — Lists, Tuples, Sets & Dictionaries',
            durationMinutes: 45,
            keyConcepts: ['Mutability vs Immutability', 'Hashable Keys', 'O(1) Dict Lookups', 'Set Operations'],
            practiceTask: 'Build a word-frequency analyzer and deduplicator using Python dicts and sets',
          },
        ],
      },
      {
        title: 'Module 2: Functions, Modular Python & Object-Oriented Programming',
        description: 'Write reusable, production-grade Python with *args/**kwargs, decorators, and classes.',
        lessons: [
          {
            title: 'Lesson 4: First-Class Functions, Closures, *args & **kwargs',
            durationMinutes: 40,
            keyConcepts: ['Positional vs Keyword Args', 'Lambda Functions', 'Decorators', 'Scope (LEGB Rule)'],
            practiceTask: 'Implement a `@measure_time` decorator that logs execution time of any Python function',
          },
          {
            title: 'Lesson 5: Object-Oriented Python — Classes, Dunder Methods & Inheritance',
            durationMinutes: 50,
            keyConcepts: ['__init__ & __repr__', 'Encapsulation', 'Composition vs Inheritance', 'Dataclasses'],
            practiceTask: 'Design a BankAccount & Transaction ledger class hierarchy with `@dataclass`',
          },
        ],
      },
      {
        title: 'Module 3: File I/O, Error Handling, APIs & Real-World Python Projects',
        description: 'Work with JSON files, context managers, HTTP requests, and automated testing.',
        lessons: [
          {
            title: 'Lesson 6: Context Managers (`with`), Exceptions & JSON Data Pipelines',
            durationMinutes: 40,
            keyConcepts: ['try/except/finally', 'Custom Exceptions', 'Context Managers', 'Pathlib & JSON'],
            practiceTask: 'Build a fault-tolerant JSON log parser that gracefully handles malformed entries',
          },
          {
            title: 'Lesson 7: Generators, Iterators & Async Python Fundamentals',
            durationMinutes: 45,
            keyConcepts: ['yield Keyword', 'Lazy Evaluation', 'Memory-Efficient Streams', 'asyncio Basics'],
            practiceTask: 'Write a Python generator pipeline that processes a 1GB CSV file in O(1) memory',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'web') {
    return [
      {
        title: 'Module 1: Modern JavaScript / TypeScript & Asynchronous Runtime',
        description: 'Event loop internals, closures, Promises, async/await, and strict TypeScript types.',
        lessons: [
          {
            title: 'Lesson 1: Call Stack, Microtask Queue & Async/Await Execution',
            durationMinutes: 40,
            keyConcepts: ['Event Loop', 'Promises & Microtasks', 'Closures', 'Lexical Scope'],
            practiceTask: 'Implement a custom `Promise.all` and debounced search handler from scratch',
          },
          {
            title: 'Lesson 2: Component Architecture, State Hooks & Rendering Lifecycle',
            durationMinutes: 45,
            keyConcepts: ['Declarative UI', 'useState & useEffect', 'Referential Equality', 'Custom Hooks'],
            practiceTask: 'Build a synchronized filterable dashboard with URL query state persistence',
          },
        ],
      },
      {
        title: 'Module 2: Backend APIs, Authentication & Database Persistence',
        description: 'RESTful API design, middleware pipelines, validation, and data modeling.',
        lessons: [
          {
            title: 'Lesson 3: REST API Design, Middleware & Input Validation',
            durationMinutes: 45,
            keyConcepts: ['HTTP Status Codes', 'Request Validation', 'Error Handling Middleware'],
            practiceTask: 'Build a complete CRUD API endpoint with schema validation and rate limiting',
          },
          {
            title: 'Lesson 4: Authentication Flows, JWT Security & Deployment',
            durationMinutes: 50,
            keyConcepts: ['Session vs JWT', 'HttpOnly Cookies', 'CORS', 'Production Build'],
            practiceTask: 'Secure protected API routes and write end-to-end integration tests',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'ai') {
    return [
      {
        title: 'Module 1: Foundations of Machine Learning & Vector Math',
        description: 'Supervised vs unsupervised learning, loss functions, and gradient descent.',
        lessons: [
          {
            title: 'Lesson 1: Features, Labels, Loss Functions & Gradient Descent Intuition',
            durationMinutes: 45,
            keyConcepts: ['MSE Loss', 'Learning Rate', 'Partial Derivatives', 'Vectorization'],
            practiceTask: 'Implement Linear Regression with Gradient Descent in pure NumPy',
          },
          {
            title: 'Lesson 2: Model Evaluation, Overfitting & Regularization',
            durationMinutes: 40,
            keyConcepts: ['Train/Val/Test Split', 'Precision & Recall', 'L1/L2 Regularization'],
            practiceTask: 'Evaluate a classification pipeline using confusion matrices and F1-score',
          },
        ],
      },
      {
        title: 'Module 2: Neural Networks, Embeddings & LLM Applications',
        description: 'Backpropagation, transformer attention, embeddings, and RAG systems.',
        lessons: [
          {
            title: 'Lesson 3: Neural Network Layers, Activations & Backpropagation',
            durationMinutes: 50,
            keyConcepts: ['ReLU & Softmax', 'Chain Rule', 'Batch Normalization'],
            practiceTask: 'Train a 2-layer neural network classifier and visualize the loss curve',
          },
          {
            title: 'Lesson 4: Embeddings, Semantic Search & Structured LLM Outputs',
            durationMinutes: 45,
            keyConcepts: ['Cosine Similarity', 'Vector Retrieval', 'Prompt Engineering'],
            practiceTask: 'Build a semantic document Q&A pipeline with structured JSON validation',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'system') {
    return [
      {
        title: 'Module 1: Scalability, Load Balancing & Caching Layers',
        description: 'Horizontal scaling, consistent hashing, Redis caching strategies, and CDNs.',
        lessons: [
          {
            title: 'Lesson 1: Vertical vs Horizontal Scaling & Load Balancers',
            durationMinutes: 40,
            keyConcepts: ['L4 vs L7 Load Balancing', 'Consistent Hashing', 'Stateless Servers'],
            practiceTask: 'Design a consistent hashing ring that minimizes key redistribution on node failure',
          },
          {
            title: 'Lesson 2: Distributed Caching Patterns (Cache-Aside, Write-Through)',
            durationMinutes: 45,
            keyConcepts: ['Cache Eviction (LRU)', 'Thundering Herd', 'TTL Tuning'],
            practiceTask: 'Implement an in-memory LRU cache with TTL expiration',
          },
        ],
      },
      {
        title: 'Module 2: Databases, Sharding, Message Queues & High Availability',
        description: 'SQL vs NoSQL trade-offs, CAP theorem, replication, and async queues.',
        lessons: [
          {
            title: 'Lesson 3: Database Replication, Partitioning & CAP Theorem',
            durationMinutes: 45,
            keyConcepts: ['Leader-Follower Replication', 'Range vs Hash Sharding', 'ACID vs BASE'],
            practiceTask: 'Design the database schema and sharding key for a high-throughput URL shortener',
          },
        ],
      },
    ];
  }

  // Dynamic Custom Subject Curriculum (never pre-completed, never hardcoded to Striver URLs)
  const cleanSubjectName = courseTitle.replace(/^DevTrack:\s*/i, '').trim() || 'Core Subject';
  return [
    {
      title: `Module 1: ${cleanSubjectName} — Core Foundations & Mental Models`,
      description: `Essential building blocks, terminology, and foundational execution patterns for ${cleanSubjectName}.`,
      lessons: [
        {
          title: `Lesson 1: Introduction, Setup & Core Architecture of ${cleanSubjectName}`,
          durationMinutes: 35,
          keyConcepts: [`${cleanSubjectName} Fundamentals`, 'Architecture Overview', 'Execution Lifecycle'],
          practiceTask: `Complete the starter setup and build a minimal working example for ${cleanSubjectName}`,
        },
        {
          title: `Lesson 2: Essential Data Patterns, State & Control Flow in ${cleanSubjectName}`,
          durationMinutes: 40,
          keyConcepts: ['Data Representation', 'State Transitions', 'Edge Case Handling'],
          practiceTask: `Implement the primary data flow pattern covered in the lecture without looking at notes`,
        },
        {
          title: `Lesson 3: Debugging, Complexity & Best Practices in ${cleanSubjectName}`,
          durationMinutes: 45,
          keyConcepts: ['Performance Bottlenecks', 'Debugging Workflow', 'Clean Code Patterns'],
          practiceTask: `Refactor your implementation and test against 3 boundary conditions`,
        },
      ],
    },
    {
      title: `Module 2: ${cleanSubjectName} — Applied Implementation & Real-World Workflows`,
      description: `Hands-on problem solving, modular design, and practical implementation for ${cleanSubjectName}.`,
      lessons: [
        {
          title: `Lesson 4: Building Modular Components & Reusable Logic in ${cleanSubjectName}`,
          durationMinutes: 45,
          keyConcepts: ['Modular Abstraction', 'Error Handling', 'Unit Testing'],
          practiceTask: `Write a modular solution with automated unit tests verifying expected outputs`,
        },
        {
          title: `Lesson 5: Capstone Project & End-to-End Integration in ${cleanSubjectName}`,
          durationMinutes: 50,
          keyConcepts: ['End-to-End Integration', 'Production Readiness', 'Optimization'],
          practiceTask: `Combine all modules into a complete working mini-project for ${cleanSubjectName}`,
        },
      ],
    },
  ];
}

export interface ScrapedPlaylistVideoItem {
  videoId: string;
  title: string;
  durationMinutes?: number;
}

export interface BuildDynamicTrackerOptions {
  inputUrl: string;
  rawTopic?: string;
  extractedData?: any;
  dailyMinutes?: number;
  scheduledTime?: string;
  studyDays?: number[];
  trackerId?: string;
}

/**
 * Converts a list of scraped YouTube playlist videos into grouped sequential modules (Lesson 1, Lesson 2, Lesson 3...)
 * where each lesson maps directly to its specific YouTube watch URL (`watch?v=VIDEO_ID&list=PLAYLIST_ID&index=N`).
 */
function buildModulesFromScrapedPlaylistVideos(
  playlistVideos: ScrapedPlaylistVideoItem[],
  playlistId: string | null,
  courseTitle: string,
  fallbackSourceUrl: string
): Array<{
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    durationMinutes: number;
    videoUrl: string;
    keyConcepts: string[];
    practiceTask: string;
  }>;
}> {
  const chunkSize = Math.max(3, Math.ceil(playlistVideos.length / 3));
  const moduleGroups: Array<{
    title: string;
    description: string;
    lessons: Array<{
      title: string;
      durationMinutes: number;
      videoUrl: string;
      keyConcepts: string[];
      practiceTask: string;
    }>;
  }> = [];

  for (let i = 0; i < playlistVideos.length; i += chunkSize) {
    const slice = playlistVideos.slice(i, i + chunkSize);
    const modNum = moduleGroups.length + 1;
    const startLec = i + 1;
    const endLec = i + slice.length;

    moduleGroups.push({
      title: `Module ${modNum}: ${courseTitle} — Lectures ${startLec} to ${endLec}`,
      description: `Sequential playlist lectures ${startLec}–${endLec} for ${courseTitle}.`,
      lessons: slice.map((vid, idxInSlice) => {
        const globalIdx = i + idxInSlice;
        const rawVidTitle = (vid.title || `Lecture ${globalIdx + 1}`).trim();
        const formattedTitle = /^(lesson|lec|lecture)\s*\d+/i.test(rawVidTitle)
          ? rawVidTitle
          : `Lesson ${globalIdx + 1}: ${rawVidTitle}`;

        const directUrl =
          vid.videoId && playlistId
            ? `https://www.youtube.com/watch?v=${vid.videoId}&list=${playlistId}&index=${globalIdx + 1}`
            : vid.videoId
            ? `https://www.youtube.com/watch?v=${vid.videoId}`
            : resolveLessonVideoUrl(fallbackSourceUrl, undefined, globalIdx, courseTitle, formattedTitle);

        return {
          title: formattedTitle,
          durationMinutes: Math.max(10, Number(vid.durationMinutes) || 30),
          videoUrl: directUrl,
          keyConcepts: [rawVidTitle, `${courseTitle} Core Concept`, 'Practical Implementation'],
          practiceTask: `Watch "${rawVidTitle}", take concise notes, and implement or solve the core example covered in Lecture ${globalIdx + 1}`,
        };
      }),
    });
  }

  return moduleGroups;
}

/**
 * Dynamically constructs a fresh, 100% synchronized Tracker from a user's YouTube URL or topic.
 * - Dynamically updates all header titles, category tags, difficulty, and instructor source.
 * - Parses playlist/first-video URLs to map Lesson 1, Lesson 2, Lesson 3 to their exact YouTube URLs/timestamps.
 * - Ensures 0% initial completion on all lessons.
 */
export function buildDynamicTrackerFromInput(options: BuildDynamicTrackerOptions): Tracker {
  const {
    inputUrl,
    rawTopic,
    extractedData,
    dailyMinutes = 60,
    scheduledTime = '20:00',
    studyDays = [1, 2, 3, 4, 5, 6],
    trackerId = `tracker-${Date.now()}`,
  } = options;

  const trimmedUrl = (inputUrl || '').trim();
  const userTopicClean =
    rawTopic && !/^https?:\/\//i.test(rawTopic.trim()) ? rawTopic.trim() : '';
  const inferred = inferCourseMetadata(trimmedUrl, userTopicClean, extractedData);
  const parsedUrl = parseYouTubeSourceUrl(trimmedUrl);

  // Determine clean course title:
  // Always ensure the user's explicit subject (e.g. "DBMS") is reflected in the header title!
  const extractedTitleClean =
    extractedData?.title &&
    !/^https?:\/\//i.test(extractedData.title.trim()) &&
    !extractedData.title.includes('Computer Science & Software Engineering Track') &&
    extractedData.title.trim().toLowerCase() !== 'computer science course'
      ? extractedData.title.trim()
      : '';

  let cleanTitle = '';
  if (userTopicClean && extractedTitleClean) {
    if (extractedTitleClean.toLowerCase().includes(userTopicClean.toLowerCase())) {
      cleanTitle = extractedTitleClean;
    } else {
      cleanTitle = `${userTopicClean}: ${extractedTitleClean}`;
    }
  } else if (userTopicClean) {
    cleanTitle = inferred.defaultTitle;
  } else if (extractedTitleClean) {
    cleanTitle = extractedTitleClean;
  } else {
    const withoutUrls = trimmedUrl.replace(/https?:\/\/[^\s]+/gi, '').trim();
    cleanTitle = withoutUrls.length > 1 ? withoutUrls : inferred.defaultTitle;
  }

  // Determine dynamic category tag (never static "Computer Science Core" when a specific subject is known)
  const category: string =
    inferred.subjectKey !== 'custom'
      ? inferred.category
      : userTopicClean
      ? userTopicClean
      : extractedData?.category && extractedData.category !== 'Computer Science Core'
      ? extractedData.category
      : inferred.category;

  const difficulty: string =
    extractedData?.difficulty &&
    extractedData.difficulty !== 'Beginner'
      ? extractedData.difficulty
      : inferred.defaultDifficulty || 'Comprehensive';

  // Determine dynamic instructor / curated source (never static "YouTube Curated Series")
  const instructor =
    extractedData?.instructor &&
    extractedData.instructor !== 'take U forward (Striver)' &&
    extractedData.instructor !== 'YouTube Curated Series'
      ? extractedData.instructor
      : inferred.defaultInstructor;

  // 1. Check if scraped playlist videos were provided
  const scrapedPlaylistVideos: ScrapedPlaylistVideoItem[] = Array.isArray(extractedData?.playlistVideos)
    ? extractedData.playlistVideos.filter((v: any) => v && (v.videoId || v.title))
    : [];

  // 2. Otherwise check if valid AI-extracted modules were provided
  const hasValidExtractedModules =
    scrapedPlaylistVideos.length === 0 &&
    Array.isArray(extractedData?.modules) &&
    extractedData.modules.length > 0 &&
    !extractedData.modules.some((m: any) =>
      (m.lessons || []).some((l: any) =>
        String(l.title || '').includes('Hashing & Frequency Counting Maps')
      )
    );

  const rawModules =
    scrapedPlaylistVideos.length > 0
      ? buildModulesFromScrapedPlaylistVideos(
          scrapedPlaylistVideos,
          parsedUrl.playlistId,
          cleanTitle,
          trimmedUrl
        )
      : hasValidExtractedModules
      ? extractedData.modules
      : buildCuratedModulesForSubject(inferred.subjectKey, cleanTitle);

  let runningLessonIdx = 0;
  let totalMinutes = 0;

  const modules: Module[] = rawModules.map((mod: any, mIdx: number) => {
    const rawLessons = Array.isArray(mod.lessons) && mod.lessons.length > 0 ? mod.lessons : [];
    const lessons: Lesson[] = rawLessons.map((les: any, lIdx: number) => {
      const currentIdx = runningLessonIdx++;
      const duration = Number(les.durationMinutes) || 40;
      totalMinutes += duration;
      const rawLessonTitle = (les.title || `Lecture ${currentIdx + 1}`).trim();
      const lessonTitle = /^(lesson|lec|lecture)\s*\d+/i.test(rawLessonTitle)
        ? rawLessonTitle
        : `Lesson ${currentIdx + 1}: ${rawLessonTitle}`;

      return {
        id: `${trackerId}-les-${mIdx + 1}-${lIdx + 1}`,
        title: lessonTitle,
        durationMinutes: duration,
        videoUrl: resolveLessonVideoUrl(
          trimmedUrl,
          les.videoUrl,
          currentIdx,
          cleanTitle,
          lessonTitle
        ),
        keyConcepts:
          Array.isArray(les.keyConcepts) && les.keyConcepts.length > 0
            ? les.keyConcepts
            : ['Core Principles', 'Hands-On Implementation'],
        practiceTask:
          les.practiceTask || `Complete the hands-on exercise for ${lessonTitle}`,
        completed: false,
      };
    });

    return {
      id: `${trackerId}-mod-${mIdx + 1}`,
      title: mod.title || `Module ${mIdx + 1}`,
      description: mod.description || `Structured learning module for ${cleanTitle}`,
      lessons,
    };
  });

  // If the user input was a first-video-of-playlist URL (watch?v=...&list=...), normalize sourceUrl or keep it so Course Playlist button opens the full playlist
  const normalizedCourseSourceUrl =
    parsedUrl.isYouTube && parsedUrl.playlistId && !trimmedUrl.includes('/playlist?')
      ? trimmedUrl
      : trimmedUrl;

  return {
    id: trackerId,
    title: cleanTitle,
    description:
      extractedData?.description &&
      !String(extractedData.description).includes('Computer Science & Software Engineering Track')
        ? extractedData.description
        : `Structured ${category} curriculum and daily study tracker for ${cleanTitle} (${runningLessonIdx} sequential lectures).`,
    category,
    difficulty,
    instructor,
    sourceUrl: normalizedCourseSourceUrl,
    totalVideos: runningLessonIdx,
    estimatedTotalMinutes: totalMinutes || runningLessonIdx * 40,
    dailyMinutesTarget: dailyMinutes,
    scheduledTime,
    studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    modules,
  };
}

/**
 * Detects and automatically repairs any custom tracker in state/localStorage
 * that was previously polluted with stale Striver DSA modules, static "Computer Science Core / YouTube Curated Series"
 * fallback headers, or unindexed lesson video URLs.
 */
export function sanitizeAndSyncTracker(tracker: Tracker): Tracker {
  // Leave the built-in preset trackers untouched
  if (tracker.id === 'tracker-dsa-striver' || tracker.id === 'tracker-fullstack-mern') {
    return tracker;
  }

  const hasStaleStriverLessons = tracker.modules.some(m =>
    m.lessons.some(
      l =>
        l.id === 'les-3' ||
        l.title.includes('Hashing & Frequency Counting Maps') ||
        l.videoUrl.includes('KEs5UyBJ39g')
    )
  );

  const isRawUrlTitle = /^https?:\/\//i.test(tracker.title.trim());
  const hasStaticFallbackHeader =
    tracker.instructor === 'YouTube Curated Series' ||
    tracker.category === 'Computer Science Core' ||
    tracker.title === 'Computer Science & Software Engineering Track' ||
    tracker.title === 'Computer Science Course';

  if (hasStaleStriverLessons || isRawUrlTitle || hasStaticFallbackHeader) {
    return buildDynamicTrackerFromInput({
      inputUrl: tracker.sourceUrl || tracker.title,
      rawTopic: isRawUrlTitle ? undefined : tracker.title,
      dailyMinutes: tracker.dailyMinutesTarget,
      scheduledTime: tracker.scheduledTime,
      studyDays: tracker.studyDays,
      trackerId: tracker.id,
    });
  }

  // Ensure every lesson in a custom tracker has its videoUrl bound to its exact index/timestamp in tracker.sourceUrl
  if (tracker.sourceUrl && /^https?:\/\//i.test(tracker.sourceUrl.trim())) {
    let idx = 0;
    return {
      ...tracker,
      modules: tracker.modules.map(mod => ({
        ...mod,
        lessons: mod.lessons.map(les => {
          const lessonIdx = idx++;
          return {
            ...les,
            videoUrl: resolveLessonVideoUrl(
              tracker.sourceUrl,
              les.videoUrl,
              lessonIdx,
              tracker.title,
              les.title
            ),
          };
        }),
      })),
    };
  }

  return tracker;
}

