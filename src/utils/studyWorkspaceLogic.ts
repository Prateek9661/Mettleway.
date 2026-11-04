import {
  Tracker,
  Module,
  Lesson,
  StudyTask,
  AIRecapData,
  LearnerProfile,
  LearnerRole,
  PacingMode,
  SkillMilestone,
  CourseStatusCategory,
  CourseAnalyticsItem,
  ProfileCourseAnalyticsSummary,
  VideoNoteItem,
  CourseSortOption,
  CourseLibraryFilterOptions,
  ContinueLearningInfo,
  WeeklyActivityDay,
  StudentDashboardSummary,
  DailyLogEntry,
} from '../types';

export type NavTab =
  | 'today'
  | 'dashboard'
  | 'library'
  | 'curriculum'
  | 'mentor'
  | 'squads'
  | 'schedule';

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
 * Resolves the currently active or user-selected lesson in a tracker along with its
 * 0-based sequential index across the entire course and its parent module title.
 * When a user clicks on "Lesson X" in the roadmap or playlist queue, `selectedLessonId`
 * overrides the default first-uncompleted lesson so the player immediately loads Lesson X.
 */
export function getActiveOrSelectedLesson(
  tracker: Tracker | null,
  selectedLessonId?: string | null
): { lesson: Lesson | null; lessonIndex: number; moduleTitle: string } {
  if (!tracker) {
    return { lesson: null, lessonIndex: 0, moduleTitle: '' };
  }

  const flattened: Array<{ lesson: Lesson; lessonIndex: number; moduleTitle: string }> = [];
  let runningIdx = 0;
  for (const mod of tracker.modules || []) {
    for (const les of mod.lessons || []) {
      flattened.push({
        lesson: les,
        lessonIndex: runningIdx++,
        moduleTitle: mod.title,
      });
    }
  }

  if (flattened.length === 0) {
    return { lesson: null, lessonIndex: 0, moduleTitle: '' };
  }

  if (selectedLessonId) {
    const matched = flattened.find(item => item.lesson.id === selectedLessonId);
    if (matched) {
      return matched;
    }
  }

  const firstUncompleted = flattened.find(item => !item.lesson.completed);
  return firstUncompleted || flattened[0];
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
  timestampSeconds?: number;
  isPlaylistOrSeries?: boolean;
}

function parseYouTubeTimestampParam(rawParam: string | null): number {
  if (!rawParam) return 0;
  const trimmed = rawParam.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  let total = 0;
  const hMatch = trimmed.match(/(\d+)h/);
  const mMatch = trimmed.match(/(\d+)m/);
  const sMatch = trimmed.match(/(\d+)s/);
  if (hMatch) total += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) total += parseInt(mMatch[1], 10) * 60;
  if (sMatch) total += parseInt(sMatch[1], 10);
  if (total > 0) return total;
  const numericPrefix = parseInt(trimmed, 10);
  return Number.isFinite(numericPrefix) && numericPrefix > 0 ? numericPrefix : 0;
}

/**
 * Parses a YouTube URL (playlist URL, first-video-of-playlist URL, or single video URL)
 * to extract videoId, playlistId, startIndex, and timestampSeconds.
 */
export function parseYouTubeSourceUrl(rawUrl: string): ParsedYouTubeSource {
  const trimmed = (rawUrl || '').trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  const candidateUrl = urlMatch ? urlMatch[0] : trimmed;

  if (!/^https?:\/\//i.test(candidateUrl)) {
    return {
      isYouTube: false,
      videoId: null,
      playlistId: null,
      startIndex: 1,
      timestampSeconds: 0,
      isPlaylistOrSeries: false,
    };
  }

  try {
    const parsed = new URL(candidateUrl);
    const host = parsed.hostname.toLowerCase();
    const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
    if (!isYouTube) {
      return {
        isYouTube: false,
        videoId: null,
        playlistId: null,
        startIndex: 1,
        timestampSeconds: 0,
        isPlaylistOrSeries: false,
      };
    }

    const playlistId = parsed.searchParams.get('list') || null;
    let videoId = parsed.searchParams.get('v') || null;

    if (!videoId && host.includes('youtu.be')) {
      const pathSeg = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (pathSeg) videoId = pathSeg;
    }

    if (!videoId && /^\/(embed|live|shorts)\/([^/?]+)/i.test(parsed.pathname)) {
      const m = parsed.pathname.match(/^\/(embed|live|shorts)\/([^/?]+)/i);
      if (m?.[2] && m[2].toLowerCase() !== 'videoseries') {
        videoId = m[2];
      }
    }

    const idxParam = parseInt(parsed.searchParams.get('index') || '1', 10);
    const tParam = parsed.searchParams.get('t') || parsed.searchParams.get('start');
    const timestampSeconds = parseYouTubeTimestampParam(tParam);
    const isPlaylistOrSeries = Boolean(
      playlistId ||
        parsed.pathname.toLowerCase().includes('/playlist') ||
        parsed.pathname.toLowerCase().includes('/videoseries')
    );

    return {
      isYouTube: true,
      videoId,
      playlistId,
      startIndex: Number.isFinite(idxParam) && idxParam > 0 ? idxParam : 1,
      timestampSeconds,
      isPlaylistOrSeries,
    };
  } catch {
    return {
      isYouTube: false,
      videoId: null,
      playlistId: null,
      startIndex: 1,
      timestampSeconds: 0,
      isPlaylistOrSeries: false,
    };
  }
}

/**
 * Strips single-lecture prefixes/suffixes (e.g., "Lecture 1:", "Lesson 01 -", "#1")
 * when deriving an overall Course Title from the first video of a YouTube playlist or series.
 */
export function normalizeCourseSeriesTitle(rawVideoOrPlaylistTitle: string): string {
  const trimmed = (rawVideoOrPlaylistTitle || '').trim();
  if (!trimmed) return '';

  // If the title has a pipe or dash separating "Lecture 1: Intro" from "Complete Course Name", prefer the course name or combine cleanly
  const segments = trimmed.split(/\s+[|—–]\s+/);
  if (segments.length >= 2) {
    const firstSeg = segments[0].trim();
    const restSeg = segments.slice(1).join(' — ').trim();
    if (/^(lecture|lesson|lec|part|ep|episode|video|day|chapter)\s*#?\d+\b/i.test(firstSeg) && restSeg.length >= 4) {
      return restSeg;
    }
  }

  const strippedPrefix = trimmed
    .replace(/^(?:lecture|lesson|lec|part|ep|episode|video|day|chapter)\s*#?\d+\s*[:\-–—|.]\s*/i, '')
    .replace(/^#\d+\s*[:\-–—|.]?\s*/i, '')
    .trim();

  return strippedPrefix.length >= 3 ? strippedPrefix : trimmed;
}

/**
 * Dynamically binds a lesson's videoUrl to its specific lecture in the active course's
 * YouTube playlist (`&index=N` + specific `videoId` if scraped) or specific timestamp (`&t=...s`)
 * for single long-form lecture videos, so clicking Lesson 2 or Lesson 3 navigates directly to that lecture
 * and NEVER repeats Lesson 1's videoId on subsequent lessons.
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

  // Check if lessonVideoUrl already has a specific scraped or curated videoId for this playlist/index
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

      // If lessonVideoUrl has a valid specific videoId for this playlist (and for Lesson 2+, is NOT repeating Lesson 1's videoId), preserve its v= and set exact index
      if (!isPlaceholderLessonUrl) {
        const parsedLesson = parseYouTubeSourceUrl(trimmedLessonUrl);
        const isDistinctFromFirstVideo =
          lessonIndex === 0 || !parsedSource.videoId || parsedLesson.videoId !== parsedSource.videoId;
        if (
          parsedLesson.videoId &&
          (!parsedLesson.playlistId || parsedLesson.playlistId === parsedSource.playlistId) &&
          isDistinctFromFirstVideo
        ) {
          return `https://www.youtube.com/watch?v=${parsedLesson.videoId}&list=${parsedSource.playlistId}&index=${targetIndex}`;
        }
      }

      // If the user provided the first video link of a playlist (watch?v=VID&list=PL...), ONLY Lesson 1 (lessonIndex === 0) may use that first video's v=VID
      if (parsedSource.videoId && lessonIndex === 0) {
        return `https://www.youtube.com/watch?v=${parsedSource.videoId}&list=${parsedSource.playlistId}&index=1`;
      }

      // For Lesson 2, Lesson 3, etc. when no distinct per-lesson videoId was scraped, strip v=FIRST_VID so Lesson 1's video NEVER repeats!
      return `https://www.youtube.com/playlist?list=${parsedSource.playlistId}&index=${targetIndex}`;
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
      const cleanUrl = trimmedSource
        .replace(/([?&])index=\d+/g, '')
        .replace(/([?&])v=[^&]+&?/g, '$1')
        .replace(/\?&/, '?');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}index=${lessonIndex + 1}`;
    }

    return trimmedSource;
  }

  // If lessonVideoUrl itself is a valid YouTube URL (e.g., from a curated preset), use it
  if (!isPlaceholderLessonUrl && /^https?:\/\//i.test(trimmedLessonUrl)) {
    return trimmedLessonUrl;
  }

  // If the user typed a topic name instead of a URL, generate a targeted YouTube search link for that specific lesson
  const query = `${courseTitle || trimmedSource} ${lessonTitle}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || 'programming tutorial')}`;
}

/**
 * Resolves the interactive embedded YouTube player URL (`https://www.youtube.com/embed/...`)
 * for any specific lesson index (`lessonIndex` 0, 1, 2, ...).
 * Guarantees that clicking "Lesson X" in the roadmap or lesson list loads Lecture X in the player
 * and NEVER defaults back to Lesson 1's video URL.
 */
export function resolveLessonEmbedUrl(
  courseSourceUrl: string,
  lessonVideoUrl?: string,
  lessonIndex: number = 0,
  seekTimestampSeconds?: number
): string {
  const parsedSource = parseYouTubeSourceUrl(courseSourceUrl || '');
  const parsedLesson = parseYouTubeSourceUrl(lessonVideoUrl || '');

  const effectivePlaylistId = parsedLesson.playlistId || parsedSource.playlistId;
  const explicitSeek =
    seekTimestampSeconds !== undefined && Number.isFinite(seekTimestampSeconds) && seekTimestampSeconds > 0
      ? Math.floor(seekTimestampSeconds)
      : 0;

  // 1. If the lesson has its own distinct YouTube videoId (or is Lesson 1 with a known videoId)
  const hasDistinctLessonVideoId =
    Boolean(parsedLesson.videoId) &&
    (lessonIndex === 0 || !parsedSource.videoId || parsedLesson.videoId !== parsedSource.videoId);

  if (hasDistinctLessonVideoId && parsedLesson.videoId) {
    const params = new URLSearchParams();
    if (effectivePlaylistId) {
      params.set('list', effectivePlaylistId);
      params.set('index', String(lessonIndex + 1));
    }
    const startSec = explicitSeek > 0 ? explicitSeek : parsedLesson.timestampSeconds || 0;
    if (startSec > 0) {
      params.set('start', String(startSec));
    }
    params.set('rel', '0');
    return `https://www.youtube.com/embed/${parsedLesson.videoId}?${params.toString()}`;
  }

  // 2. If the course has a YouTube playlistId (list=PL...), load the exact 0-based playlist index in YouTube's official playlist player
  if (effectivePlaylistId) {
    if (lessonIndex === 0 && parsedSource.videoId) {
      const params = new URLSearchParams();
      params.set('list', effectivePlaylistId);
      params.set('index', '1');
      if (explicitSeek > 0) {
        params.set('start', String(explicitSeek));
      }
      params.set('rel', '0');
      return `https://www.youtube.com/embed/${parsedSource.videoId}?${params.toString()}`;
    }
    const params = new URLSearchParams();
    params.set('listType', 'playlist');
    params.set('list', effectivePlaylistId);
    params.set('index', String(lessonIndex));
    if (explicitSeek > 0) {
      params.set('start', String(explicitSeek));
    }
    params.set('rel', '0');
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }

  // 3. If the course is a single long-form YouTube video, seek directly to Lesson X's chapter timestamp
  const fallbackVideoId = parsedSource.videoId || parsedLesson.videoId;
  if (fallbackVideoId) {
    const startSec =
      explicitSeek > 0
        ? explicitSeek
        : parsedLesson.timestampSeconds && parsedLesson.timestampSeconds > 0
        ? parsedLesson.timestampSeconds
        : lessonIndex * 1800;
    const params = new URLSearchParams();
    if (startSec > 0) {
      params.set('start', String(startSec));
    }
    params.set('rel', '0');
    return `https://www.youtube.com/embed/${fallbackVideoId}?${params.toString()}`;
  }

  return '';
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

// Known playlist IDs or video IDs for popular YouTube courses so URL-only imports immediately detect subject, title, and instructor
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
  kbdlm6hndae: {
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
  plxczcowd7aigz9donhrre9i3mwn6xdp8p: {
    title: 'Operating Systems (OS) Complete Placement & GATE Series',
    instructor: 'Gate Smashers',
    topic: 'os',
    category: 'Operating Systems',
  },
  bkswjjzngf8: {
    title: 'Operating Systems (OS) Complete Placement & GATE Series',
    instructor: 'Gate Smashers',
    topic: 'os',
    category: 'Operating Systems',
  },
  'plxczcowd7aigfbd2-2jocpwolurdlvvv_': {
    title: 'Computer Networks (CN) Complete Course',
    instructor: 'Gate Smashers',
    topic: 'cn',
    category: 'Computer Networks',
  },
  jfvxyj9bbkw: {
    title: 'Computer Networks (CN) Complete Course',
    instructor: 'Gate Smashers',
    topic: 'cn',
    category: 'Computer Networks',
  },
  plu0w_9lii9agwh1xjrt242xiphpt2llg: {
    title: 'Python Programming Complete Bootcamp (100 Days of Code)',
    instructor: 'CodeWithHarry',
    topic: 'python',
    category: 'AI & ML',
  },
  '7wnove7kc-q': {
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
  plu71skxnbfodqgpchmvisl4htnjirtige: {
    title: 'Chai aur Javascript & Full-Stack Web Development',
    instructor: 'Chai aur Code (Hitesh Choudhary)',
    topic: 'web',
    category: 'Web Development',
  },
  hdi2bqojy3c: {
    title: 'JavaScript Crash Course & Modern ES6+',
    instructor: 'Traversy Media',
    topic: 'web',
    category: 'Web Development',
  },
  plzotaelrmxvpbtrwtjkn3wwqxzkmtxgwe: {
    title: 'Complete Machine Learning & Data Science Bootcamp',
    instructor: 'Krish Naik',
    topic: 'ai',
    category: 'AI & ML',
  },
  plguwdvibif0of6ql8m22w1hidc1vj_bhz: {
    title: "Striver's A2Z DSA Course / Sheet",
    instructor: 'take U forward (Striver)',
    topic: 'dsa',
    category: 'DSA',
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
    videoUrl?: string;
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
            videoUrl: 'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=1',
            keyConcepts: ['Physical vs Logical Independence', '3-Schema Architecture', 'DBA Role & DBMS Internals'],
            practiceTask: 'Draw the 3-level ANSI-SPARC architecture and trace how a query maps from view level to physical storage',
          },
          {
            title: 'Lesson 2: Entity-Relationship (ER) Model, Attributes & Relational Keys',
            durationMinutes: 40,
            videoUrl: 'https://www.youtube.com/watch?v=3EJlovevfcA&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=2',
            keyConcepts: ['Super, Candidate, Primary & Foreign Keys', 'Strong vs Weak Entities', 'Cardinality Ratios (1:1, 1:N, M:N)'],
            practiceTask: 'Design a complete ER diagram for a University Course Enrollment system and convert ER tables into relational schemas',
          },
          {
            title: 'Lesson 3: Relational Model, Integrity Constraints & Relational Algebra Operations',
            durationMinutes: 45,
            videoUrl: 'https://www.youtube.com/watch?v=pDX4NR4eY3A&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=3',
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
            videoUrl: 'https://www.youtube.com/watch?v=ADb5TW09bdE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=4',
            keyConcepts: ['INNER, LEFT, RIGHT & FULL Joins', 'GROUP BY & HAVING', 'Correlated Subqueries', 'Window Functions'],
            practiceTask: 'Write SQL queries to find the Nth highest salary and department-wise top earners using both subqueries and window functions',
          },
          {
            title: 'Lesson 5: Functional Dependencies, Armstrong Axioms & Attribute Closure',
            durationMinutes: 40,
            videoUrl: 'https://www.youtube.com/watch?v=wClEbCyWryI&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=5',
            keyConcepts: ['Trivial vs Non-Trivial FD', 'Attribute Closure (X+)', 'Canonical Cover', 'Lossless Join Decomposition'],
            practiceTask: 'Compute attribute closures to find all candidate keys of a given relation R(A,B,C,D,E)',
          },
          {
            title: 'Lesson 6: Database Normalization — 1NF, 2NF, 3NF & Boyce-Codd Normal Form (BCNF)',
            durationMinutes: 45,
            videoUrl: 'https://www.youtube.com/watch?v=5GDTIUVlHB8&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=6',
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
            videoUrl: 'https://www.youtube.com/watch?v=t5hsV9lC1rU&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=7',
            keyConcepts: ['Atomicity, Consistency, Isolation, Durability', 'Read-Write Conflicts', 'Precedence Graph', 'Two-Phase Locking (2PL)'],
            practiceTask: 'Construct a precedence graph for a 3-transaction schedule to test whether it is conflict serializable',
          },
          {
            title: 'Lesson 8: Database Indexing, B-Trees, B+ Trees & Query Optimization',
            durationMinutes: 40,
            videoUrl: 'https://www.youtube.com/watch?v=E--yzX05_k8&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=8',
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
            videoUrl: 'https://www.youtube.com/watch?v=bkSWJJZNgf8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=1',
            keyConcepts: ['Monolithic vs Microkernel', 'System Calls (fork, exec, wait)', 'Context Switching'],
            practiceTask: 'Trace the lifecycle of a process creation using fork() and exec() system calls',
          },
          {
            title: 'Lesson 2: Process States, PCB, Threads & Multithreading Models',
            durationMinutes: 40,
            videoUrl: 'https://www.youtube.com/watch?v=OrM7nZcxXZU&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=2',
            keyConcepts: ['5-State Process Model', 'Process Control Block (PCB)', 'User vs Kernel Threads'],
            practiceTask: 'Compare memory layout shared between threads vs isolated processes',
          },
          {
            title: 'Lesson 3: CPU Scheduling — FCFS, SJF, SRTF, Round Robin & Priority',
            durationMinutes: 45,
            videoUrl: 'https://www.youtube.com/watch?v=EWkQl0n0w5M&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=3',
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
            videoUrl: 'https://www.youtube.com/watch?v=Sw8M23WCr6I&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=4',
            keyConcepts: ['Race Condition', 'Mutual Exclusion', 'Counting vs Binary Semaphores', 'Producer-Consumer Problem'],
            practiceTask: 'Write pseudocode using semaphores to solve the bounded-buffer Producer-Consumer problem without deadlock',
          },
          {
            title: 'Lesson 5: Deadlock Conditions, Resource Allocation Graph & Banker’s Algorithm',
            durationMinutes: 40,
            videoUrl: 'https://www.youtube.com/watch?v=rWFH6PLOIEI&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=5',
            keyConcepts: ['Coffman 4 Conditions', 'Safe State Sequence', 'Deadlock Avoidance vs Prevention'],
            practiceTask: 'Run Banker’s Algorithm on a 5-process, 3-resource matrix to determine the safe execution sequence',
          },
          {
            title: 'Lesson 6: Virtual Memory, Paging, TLB & Page Replacement (LRU, Optimal, FIFO)',
            durationMinutes: 45,
            videoUrl: 'https://www.youtube.com/watch?v=qlH4-oHnBb8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=6',
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
          {
            title: 'Lesson 3: Client-Side Routing, Data Fetching & Caching Patterns',
            durationMinutes: 40,
            keyConcepts: ['Dynamic Routes', 'Stale-While-Revalidate', 'Optimistic UI Updates', 'Error Boundaries'],
            practiceTask: 'Implement paginated data fetching with optimistic state rollback on failure',
          },
        ],
      },
      {
        title: 'Module 2: Backend APIs, Authentication & Database Persistence',
        description: 'RESTful API design, middleware pipelines, validation, and data modeling.',
        lessons: [
          {
            title: 'Lesson 4: REST API Design, Middleware & Input Validation',
            durationMinutes: 45,
            keyConcepts: ['HTTP Status Codes', 'Request Validation', 'Error Handling Middleware'],
            practiceTask: 'Build a complete CRUD API endpoint with schema validation and rate limiting',
          },
          {
            title: 'Lesson 5: Database Modeling, Indexing & ORM Query Optimization',
            durationMinutes: 45,
            keyConcepts: ['Schema Design', 'Transactions', 'N+1 Query Prevention', 'Connection Pooling'],
            practiceTask: 'Design relational/document schemas and optimize a slow multi-collection query',
          },
          {
            title: 'Lesson 6: Authentication Flows, JWT Security & Cloud Deployment',
            durationMinutes: 50,
            keyConcepts: ['Session vs JWT', 'HttpOnly Cookies', 'CORS', 'Production CI/CD Build'],
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
          {
            title: 'Lesson 3: Decision Trees, Random Forests & Gradient Boosting (XGBoost)',
            durationMinutes: 45,
            keyConcepts: ['Information Gain', 'Bagging vs Boosting', 'Feature Importance', 'Hyperparameter Tuning'],
            practiceTask: 'Train and compare Random Forest vs Gradient Boosted Trees on a tabular dataset',
          },
        ],
      },
      {
        title: 'Module 2: Neural Networks, Embeddings & LLM Applications',
        description: 'Backpropagation, transformer attention, embeddings, and RAG systems.',
        lessons: [
          {
            title: 'Lesson 4: Neural Network Layers, Activations & Backpropagation',
            durationMinutes: 50,
            keyConcepts: ['ReLU & Softmax', 'Chain Rule', 'Batch Normalization'],
            practiceTask: 'Train a 2-layer neural network classifier and visualize the loss curve',
          },
          {
            title: 'Lesson 5: Transformer Architecture, Self-Attention & Tokenization',
            durationMinutes: 45,
            keyConcepts: ['Query-Key-Value Attention', 'Positional Encoding', 'Context Windows'],
            practiceTask: 'Implement scaled dot-product attention in PyTorch/NumPy and inspect attention weights',
          },
          {
            title: 'Lesson 6: Embeddings, Vector Search & Production RAG Pipelines',
            durationMinutes: 45,
            keyConcepts: ['Cosine Similarity', 'Chunking Strategies', 'Structured LLM Outputs'],
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
          {
            title: 'Lesson 3: Content Delivery Networks (CDNs), Rate Limiting & API Gateways',
            durationMinutes: 40,
            keyConcepts: ['Token Bucket', 'Sliding Window Counter', 'Edge Caching', 'Reverse Proxy'],
            practiceTask: 'Implement a Redis-backed sliding window rate limiter middleware',
          },
        ],
      },
      {
        title: 'Module 2: Databases, Sharding, Message Queues & High Availability',
        description: 'SQL vs NoSQL trade-offs, CAP theorem, replication, and async queues.',
        lessons: [
          {
            title: 'Lesson 4: Database Replication, Partitioning & CAP Theorem',
            durationMinutes: 45,
            keyConcepts: ['Leader-Follower Replication', 'Range vs Hash Sharding', 'ACID vs BASE'],
            practiceTask: 'Design the database schema and sharding key for a high-throughput URL shortener',
          },
          {
            title: 'Lesson 5: Asynchronous Message Queues, Event-Driven Architecture & Kafka',
            durationMinutes: 45,
            keyConcepts: ['Pub/Sub vs Point-to-Point', 'Idempotent Consumers', 'Dead Letter Queues'],
            practiceTask: 'Design an event-driven order processing pipeline with retry and DLQ handling',
          },
          {
            title: 'Lesson 6: Observability, Distributed Tracing & Fault Tolerance',
            durationMinutes: 45,
            keyConcepts: ['Circuit Breakers', 'SLIs/SLOs', 'Distributed Tracing', 'Graceful Degradation'],
            practiceTask: 'Implement a circuit breaker wrapper around an external service call',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'dsa') {
    return [
      {
        title: 'Module 1: Complexity Analysis, Arrays, Hashing & Two-Pointer Patterns',
        description: 'Time/space complexity, prefix sums, frequency maps, and sliding window techniques.',
        lessons: [
          {
            title: 'Lesson 1: Time & Space Complexity (Big-O) & Asymptotic Analysis',
            durationMinutes: 35,
            keyConcepts: ['Big-O, Omega, Theta', 'Amortized Complexity', 'Recursion Tree Analysis'],
            practiceTask: 'Analyze time and auxiliary space complexity for 5 iterative and recursive functions',
          },
          {
            title: 'Lesson 2: Arrays, Prefix Sums & Hashing Frequency Maps',
            durationMinutes: 45,
            keyConcepts: ['Prefix Sum Array', 'O(1) Hash Lookups', 'Subarray Sum Equals K'],
            practiceTask: 'Solve Two-Sum, Longest Consecutive Sequence, and Subarray Sum Equals K in O(N) time',
          },
          {
            title: 'Lesson 3: Two Pointers & Variable-Size Sliding Window',
            durationMinutes: 45,
            keyConcepts: ['Converging Pointers', 'Window Invariant', 'Monotonic Window'],
            practiceTask: 'Implement Longest Substring Without Repeating Characters and Container With Most Water',
          },
        ],
      },
      {
        title: 'Module 2: Binary Search, Linked Lists, Trees & Graph Algorithms',
        description: 'Search space reduction, pointer manipulation, tree traversals, and shortest paths.',
        lessons: [
          {
            title: 'Lesson 4: Binary Search on Arrays & Monotonic Answer Spaces',
            durationMinutes: 45,
            keyConcepts: ['Lower/Upper Bound', 'Rotated Sorted Array', 'Binary Search on Answer'],
            practiceTask: 'Solve Koko Eating Bananas and Search in Rotated Sorted Array without off-by-one bugs',
          },
          {
            title: 'Lesson 5: Binary Trees, BSTs, DFS/BFS Traversals & Lowest Common Ancestor',
            durationMinutes: 50,
            keyConcepts: ['Preorder/Inorder/Postorder', 'Level-Order BFS', 'Height & Diameter'],
            practiceTask: 'Implement iterative Inorder traversal and Maximum Path Sum in a Binary Tree',
          },
          {
            title: 'Lesson 6: Graphs (BFS, DFS, Topological Sort, Dijkstra) & Dynamic Programming',
            durationMinutes: 55,
            keyConcepts: ['Adjacency List', 'Cycle Detection', 'Memoization vs Tabulation'],
            practiceTask: 'Implement Course Schedule (Topological Sort) and 0/1 Knapsack with space optimization',
          },
        ],
      },
    ];
  }

  // Dynamic Custom Subject Curriculum (never pre-completed, never hardcoded to Striver URLs)
  const cleanSubjectName = normalizeCourseSeriesTitle(
    courseTitle.replace(/^DevTrack:\s*/i, '').trim() || 'Core Subject'
  );
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
          title: `Lesson 5: Advanced Workflows, Performance Tuning & Integration in ${cleanSubjectName}`,
          durationMinutes: 45,
          keyConcepts: ['Concurrency & Async Patterns', 'Resource Optimization', 'API Integration'],
          practiceTask: `Benchmark and optimize a multi-step workflow in ${cleanSubjectName}`,
        },
        {
          title: `Lesson 6: Capstone Project & End-to-End Production Build in ${cleanSubjectName}`,
          durationMinutes: 50,
          keyConcepts: ['End-to-End Integration', 'Production Readiness', 'Deployment & Review'],
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
  thumbnail?: string;
  playlistPosition?: number;
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
 * where each lesson maps directly to its specific YouTube watch URL (`watch?v=VIDEO_ID&list=PLAYLIST_ID&index=N`),
 * deduplicated by `videoId` while preserving original playlist order.
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
    videoId?: string;
    thumbnail?: string;
    playlistPosition: number;
    videoUrl: string;
    keyConcepts: string[];
    practiceTask: string;
  }>;
}> {
  // Deduplicate by videoId while preserving playlist order
  const seenVideoIds = new Set<string>();
  const dedupedVideos: ScrapedPlaylistVideoItem[] = [];
  for (const v of playlistVideos) {
    if (!v) continue;
    const vid = (v.videoId || '').trim();
    if (vid) {
      if (seenVideoIds.has(vid)) continue;
      seenVideoIds.add(vid);
    }
    dedupedVideos.push(v);
  }

  const chunkSize =
    dedupedVideos.length > 30
      ? 10
      : dedupedVideos.length > 12
      ? 6
      : Math.max(3, Math.ceil(dedupedVideos.length / 3));
  const moduleGroups: Array<{
    title: string;
    description: string;
    lessons: Array<{
      title: string;
      durationMinutes: number;
      videoId?: string;
      thumbnail?: string;
      playlistPosition: number;
      videoUrl: string;
      keyConcepts: string[];
      practiceTask: string;
    }>;
  }> = [];

  for (let i = 0; i < dedupedVideos.length; i += chunkSize) {
    const slice = dedupedVideos.slice(i, i + chunkSize);
    const modNum = moduleGroups.length + 1;
    const startLec = i + 1;
    const endLec = i + slice.length;

    moduleGroups.push({
      title: `Module ${modNum}: ${courseTitle} — Lectures ${startLec} to ${endLec}`,
      description: `Sequential playlist lectures ${startLec}–${endLec} for ${courseTitle}.`,
      lessons: slice.map((vid, idxInSlice) => {
        const globalIdx = i + idxInSlice;
        const playlistPosition = globalIdx + 1;
        const cleanVideoId = (vid.videoId || '').trim() || undefined;
        const rawVidTitle = (vid.title || `Lecture ${playlistPosition}`).trim();
        const formattedTitle = /^(lesson|lec|lecture)\s*\d+/i.test(rawVidTitle)
          ? rawVidTitle
          : `Lesson ${playlistPosition}: ${rawVidTitle}`;

        const directUrl =
          cleanVideoId && playlistId
            ? `https://www.youtube.com/watch?v=${cleanVideoId}&list=${playlistId}&index=${playlistPosition}`
            : cleanVideoId
            ? `https://www.youtube.com/watch?v=${cleanVideoId}`
            : resolveLessonVideoUrl(fallbackSourceUrl, undefined, globalIdx, courseTitle, formattedTitle);

        const thumbnail =
          (vid.thumbnail || '').trim() ||
          (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : undefined);

        return {
          title: formattedTitle,
          durationMinutes: Math.max(10, Number(vid.durationMinutes) || 30),
          videoId: cleanVideoId,
          thumbnail,
          playlistPosition,
          videoUrl: directUrl,
          keyConcepts: [rawVidTitle, `${courseTitle} Core Concept`, 'Practical Implementation'],
          practiceTask: `Watch "${rawVidTitle}", take concise notes, and implement or solve the core example covered in Lecture ${playlistPosition}`,
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
  const userTopicRaw =
    rawTopic && !/^https?:\/\//i.test(rawTopic.trim()) ? rawTopic.trim() : '';
  const userTopicClean = normalizeCourseSeriesTitle(userTopicRaw);
  const inferred = inferCourseMetadata(trimmedUrl, userTopicClean, extractedData);
  const parsedUrl = parseYouTubeSourceUrl(trimmedUrl);
  const effectivePlaylistId =
    (extractedData?.playlistId && String(extractedData.playlistId).trim()) ||
    parsedUrl.playlistId ||
    null;

  // Determine clean course title:
  // Always ensure the user's explicit subject (e.g. "DBMS") is reflected in the header title!
  const extractedTitleRaw =
    extractedData?.title &&
    !/^https?:\/\//i.test(extractedData.title.trim()) &&
    !extractedData.title.includes('Computer Science & Software Engineering Track') &&
    extractedData.title.trim().toLowerCase() !== 'computer science course'
      ? extractedData.title.trim()
      : '';
  const extractedTitleClean = normalizeCourseSeriesTitle(extractedTitleRaw);

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
    cleanTitle = withoutUrls.length > 1 ? normalizeCourseSeriesTitle(withoutUrls) : inferred.defaultTitle;
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

  // 1. Check if scraped playlist videos were provided (require at least 2 videos to form a multi-lecture playlist;
  // if only 1 video was scraped from a playlist URL, we combine it with the full subject curriculum so it never saves only 1 lesson!)
  const rawScrapedPlaylistVideos: ScrapedPlaylistVideoItem[] = Array.isArray(extractedData?.playlistVideos)
    ? extractedData.playlistVideos.filter((v: any) => v && (v.videoId || v.title))
    : [];
  const seenScrapedIds = new Set<string>();
  const scrapedPlaylistVideos: ScrapedPlaylistVideoItem[] = [];
  for (const v of rawScrapedPlaylistVideos) {
    const vid = (v.videoId || '').trim();
    if (vid) {
      if (seenScrapedIds.has(vid)) continue;
      seenScrapedIds.add(vid);
    }
    scrapedPlaylistVideos.push(v);
  }

  // 2. Otherwise check if valid AI-extracted modules were provided (must have at least 2 total lessons)
  const extractedLessonCount = Array.isArray(extractedData?.modules)
    ? extractedData.modules.reduce(
        (sum: number, m: any) => sum + (Array.isArray(m?.lessons) ? m.lessons.length : 0),
        0
      )
    : 0;

  const hasValidExtractedModules =
    scrapedPlaylistVideos.length < 2 &&
    extractedLessonCount >= 2 &&
    !extractedData.modules.some((m: any) =>
      (m.lessons || []).some((l: any) =>
        String(l.title || '').includes('Hashing & Frequency Counting Maps')
      )
    );

  const rawModules =
    scrapedPlaylistVideos.length >= 2
      ? buildModulesFromScrapedPlaylistVideos(
          scrapedPlaylistVideos,
          effectivePlaylistId,
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

      // If the user pasted a specific first video from a playlist and we only had its title for Lesson 1,
      // preserve that exact first video title on Lesson 1 if appropriate
      let rawLessonTitle = (les.title || `Lecture ${currentIdx + 1}`).trim();
      if (
        currentIdx === 0 &&
        scrapedPlaylistVideos.length === 1 &&
        scrapedPlaylistVideos[0].title
      ) {
        rawLessonTitle = scrapedPlaylistVideos[0].title.trim();
      }

      const lessonTitle = /^(lesson|lec|lecture)\s*\d+/i.test(rawLessonTitle)
        ? rawLessonTitle
        : `Lesson ${currentIdx + 1}: ${rawLessonTitle}`;

      // When a lesson already has its own verified videoId (from playlist discovery / scrapedPlaylistVideos),
      // use its exact videoUrl directly so Case 2 of resolveLessonVideoUrl never overwrites it with the first video!
      const resolvedVideoUrl =
        les.videoId && les.videoUrl
          ? les.videoUrl
          : resolveLessonVideoUrl(
              trimmedUrl,
              les.videoUrl,
              currentIdx,
              cleanTitle,
              lessonTitle
            );
      const parsedResolved = parseYouTubeSourceUrl(resolvedVideoUrl);
      const resolvedVideoId = (les.videoId || parsedResolved.videoId || '').trim() || undefined;
      const resolvedThumbnail =
        (les.thumbnail || '').trim() ||
        (resolvedVideoId ? `https://i.ytimg.com/vi/${resolvedVideoId}/hqdefault.jpg` : undefined);
      const resolvedPosition =
        typeof les.playlistPosition === 'number' && les.playlistPosition > 0
          ? les.playlistPosition
          : currentIdx + 1;

      return {
        id: `${trackerId}-les-${mIdx + 1}-${lIdx + 1}`,
        title: lessonTitle,
        durationMinutes: duration,
        videoId: resolvedVideoId,
        thumbnail: resolvedThumbnail,
        playlistPosition: resolvedPosition,
        videoUrl: resolvedVideoUrl,
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

  // If Smart Discovery resolved a playlistId for a single-video URL, upgrade sourceUrl to include the playlist
  const normalizedCourseSourceUrl =
    effectivePlaylistId && !trimmedUrl.includes('list=')
      ? `https://www.youtube.com/playlist?list=${effectivePlaylistId}`
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
 * fallback headers, single-video-only roadmaps, or unindexed lesson video URLs.
 */
export function sanitizeAndSyncTracker(tracker: Tracker): Tracker {
  // Leave the built-in preset trackers untouched
  if (tracker.id === 'tracker-dsa-striver' || tracker.id === 'tracker-fullstack-mern') {
    return tracker;
  }

  const allLessons = tracker.modules.flatMap(m => m.lessons);
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
  const hasOnlySingleLesson = allLessons.length <= 1;

  if (hasStaleStriverLessons || isRawUrlTitle || hasStaticFallbackHeader || hasOnlySingleLesson) {
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

/**
 * Generates dynamic, course-specific AI Mentor Recap data (summary, practicalChallenges, pitfalls, mentorAdvice)
 * for the active tracker so switching or adding a course completely resets stale DSA recap content.
 */
export function buildDefaultRecapForTracker(tracker: Tracker, streakDays: number = 4): AIRecapData {
  const allLessons = tracker.modules.flatMap(m => m.lessons);
  const completedLessons = allLessons.filter(l => l.completed);
  const focusLessons = completedLessons.length > 0 ? completedLessons.slice(-2) : allLessons.slice(0, 2);

  const firstLesson = focusLessons[0] || {
    title: `${tracker.title} Fundamentals`,
    keyConcepts: [tracker.category, 'Core Architecture'],
    practiceTask: `Complete the hands-on exercise for ${tracker.title}`,
  };
  const secondLesson = focusLessons[1] || firstLesson;

  const conceptA = firstLesson.keyConcepts?.[0] || firstLesson.title;
  const conceptB = secondLesson.keyConcepts?.[1] || secondLesson.keyConcepts?.[0] || secondLesson.title;

  return {
    summary: `In your active "${tracker.title}" (${tracker.category}) track (${Math.max(
      streakDays,
      1
    )}-day study streak), your current focus covers "${firstLesson.title}" and "${secondLesson.title}". Master the core mental model of ${conceptA} first, then connect it directly to ${conceptB} through hands-on implementation.`,
    practicalChallenges: [
      {
        title: `Hands-On Lab: ${conceptA}`,
        difficulty: 'Easy',
        description:
          firstLesson.practiceTask ||
          `Build a clean, working implementation demonstrating ${conceptA} from "${firstLesson.title}".`,
        starterHint: `Start by outlining the inputs, state transitions, and expected output for ${conceptA} on a small 3-item example.`,
      },
      {
        title: `Applied Challenge: ${conceptB}`,
        difficulty: 'Medium',
        description:
          secondLesson.practiceTask ||
          `Apply ${conceptB} from "${secondLesson.title}" to solve a realistic scenario and verify edge cases.`,
        starterHint: `Test boundary conditions and trace how ${conceptA} interacts with ${conceptB} step-by-step.`,
      },
    ],
    pitfalls: [
      `Watching "${firstLesson.title}" passively without completing the hands-on practice task ("${firstLesson.practiceTask}").`,
      `Skipping edge-case verification when applying ${conceptA} and ${conceptB} in real-world scenarios.`,
    ],
    mentorAdvice: `While studying "${tracker.title}", pause after each lecture to summarize ${conceptA} in 2 sentences in your own words—active recall locks in mastery 3x faster.`,
  };
}

function decodeXmlEntitiesClient(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Parses a YouTube playlist XML feed string (`<entry><yt:videoId>...</yt:videoId><title>...</title></entry>`)
 * into a structured array of `ScrapedPlaylistVideoItem` objects.
 */
export function parseYouTubePlaylistXmlFeed(xml: string): {
  playlistTitle: string;
  playlistAuthor: string;
  videos: ScrapedPlaylistVideoItem[];
} {
  const videos: ScrapedPlaylistVideoItem[] = [];
  if (!xml || typeof xml !== 'string') {
    return { playlistTitle: '', playlistAuthor: '', videos };
  }

  const headerPart = xml.split('<entry>')[0] || '';
  const plTitleMatch = headerPart.match(/<title>([\s\S]*?)<\/title>/);
  const plAuthorMatch = headerPart.match(/<author>\s*<name>([\s\S]*?)<\/name>/);
  const playlistTitle = plTitleMatch?.[1] ? decodeXmlEntitiesClient(plTitleMatch[1].trim()) : '';
  const playlistAuthor = plAuthorMatch?.[1] ? decodeXmlEntitiesClient(plAuthorMatch[1].trim()) : '';

  const entryRegex = /<entry>[\s\S]*?<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null && videos.length < 15) {
    const vid = m[1].trim();
    const vidTitle = decodeXmlEntitiesClient(m[2].trim());
    if (vid && vidTitle && !videos.some(v => v.videoId === vid)) {
      videos.push({
        videoId: vid,
        title: vidTitle,
        durationMinutes: 35,
      });
    }
  }

  return { playlistTitle, playlistAuthor, videos };
}

/**
 * Client-side YouTube metadata & playlist auto-detector (works in browser even on static deployments like Cloudflare Workers).
 * Uses CORS-friendly noembed.com + public playlist XML feed proxy + known playlist catalog to auto-detect course title, instructor, and sequential playlist lectures.
 */
export async function fetchYouTubeMetadataClientSide(rawUrl: string): Promise<{
  title: string;
  instructor: string;
  category: string;
  playlistVideos?: ScrapedPlaylistVideoItem[];
} | null> {
  const trimmed = (rawUrl || '').trim();
  const parsed = parseYouTubeSourceUrl(trimmed);
  if (!parsed.isYouTube) return null;

  const inferred = inferCourseMetadata(trimmed);
  let title = '';
  let instructor = '';
  let playlistVideos: ScrapedPlaylistVideoItem[] = [];

  // 1. Check known playlist/video hints first
  for (const [idKey, meta] of Object.entries(KNOWN_YOUTUBE_PLAYLIST_HINTS)) {
    if (trimmed.toLowerCase().includes(idKey.toLowerCase())) {
      title = meta.title;
      instructor = meta.instructor;
      break;
    }
  }

  // 2. If a playlistId is present, try fetching the playlist's XML feed via CORS-friendly proxy to get all sequential videos
  if (parsed.playlistId) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(parsed.playlistId)}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);
      const feedRes = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (feedRes.ok) {
        const xmlText = await feedRes.text();
        const parsedFeed = parseYouTubePlaylistXmlFeed(xmlText);
        if (parsedFeed.playlistTitle && !title) {
          title = parsedFeed.playlistTitle;
        }
        if (parsedFeed.playlistAuthor && !instructor) {
          instructor = parsedFeed.playlistAuthor;
        }
        if (parsedFeed.videos.length >= 2) {
          playlistVideos = parsedFeed.videos;
        }
      }
    } catch {
      // Ignore proxy timeout/CORS error and fall back to oEmbed + subject curriculum builder
    }
  }

  // 3. Query CORS-friendly noembed.com for playlist or video metadata
  try {
    const targetUrl =
      parsed.playlistId && !parsed.videoId
        ? `https://www.youtube.com/playlist?list=${parsed.playlistId}`
        : parsed.videoId
        ? `https://www.youtube.com/watch?v=${parsed.videoId}`
        : trimmed;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.title && !title) {
        title = normalizeCourseSeriesTitle(String(data.title).trim());
      }
      if (data?.author_name && !instructor) {
        instructor = String(data.author_name).trim();
      }
    }
  } catch {
    // Fallback to inferred metadata if offline
  }

  const normalizedTitle = normalizeCourseSeriesTitle(title);
  const finalMeta = inferCourseMetadata(trimmed, normalizedTitle, {
    title: normalizedTitle,
    instructor,
  });

  return {
    title: normalizedTitle || finalMeta.defaultTitle,
    instructor: instructor || finalMeta.defaultInstructor,
    category: finalMeta.category || inferred.category,
    ...(playlistVideos.length >= 2 ? { playlistVideos } : {}),
  };
}

export interface LearnerRoleOption {
  role: LearnerRole;
  description: string;
  defaultObjective: string;
  defaultPacing: PacingMode;
}

export const LEARNER_ROLE_OPTIONS: LearnerRoleOption[] = [
  {
    role: 'Software Engineer',
    description: 'Deepening system design, cloud architecture, or AI engineering skills.',
    defaultObjective: 'Master Scalable System Design & Production Engineering',
    defaultPacing: 'after-work',
  },
  {
    role: 'Working Professional',
    description: 'Upskilling after office hours for career advancement or leadership transitions.',
    defaultObjective: 'Advance Technical Depth & Ship High-Impact Projects After Hours',
    defaultPacing: 'after-work',
  },
  {
    role: 'Freelancer & Consultant',
    description: 'Expanding technical stack to deliver end-to-end client solutions faster.',
    defaultObjective: 'Master Full-Stack Delivery & Client Architecture Workflows',
    defaultPacing: 'steady-daily',
  },
  {
    role: 'Career Switcher',
    description: 'Structured transition into software engineering, data science, or product roles.',
    defaultObjective: 'Build Job-Ready Portfolio & Crack Technical Interviews',
    defaultPacing: 'intensive-bootcamp',
  },
  {
    role: 'University Student',
    description: 'Building core computer science foundations, projects, and interview readiness.',
    defaultObjective: 'Master Core Engineering Subjects & Problem-Solving',
    defaultPacing: 'steady-daily',
  },
  {
    role: 'Lifelong Learner',
    description: 'Self-paced exploration of emerging technologies, AI, and creative coding.',
    defaultObjective: 'Continuous Skill Mastery & Hands-On Exploration',
    defaultPacing: 'weekend-sprint',
  },
];

export interface PacingPresetConfig {
  mode: PacingMode;
  label: string;
  subtitle: string;
  dailyMinutesTarget: number;
  preferredTime: string;
  studyDays: number[];
}

export const PACING_PRESETS: PacingPresetConfig[] = [
  {
    mode: 'after-work',
    label: 'After-Hours Upskilling',
    subtitle: 'Mon–Fri · 45 mins/day · 21:00 (Ideal for working professionals)',
    dailyMinutesTarget: 45,
    preferredTime: '21:00',
    studyDays: [1, 2, 3, 4, 5],
  },
  {
    mode: 'weekend-sprint',
    label: 'Weekend Deep-Dive Sprint',
    subtitle: 'Sat–Sun · 120 mins/day · 10:00 (Focused weekend execution)',
    dailyMinutesTarget: 120,
    preferredTime: '10:00',
    studyDays: [0, 6],
  },
  {
    mode: 'steady-daily',
    label: 'Steady Daily Habit',
    subtitle: 'Mon–Sat · 60 mins/day · 20:00 (Consistent daily momentum)',
    dailyMinutesTarget: 60,
    preferredTime: '20:00',
    studyDays: [1, 2, 3, 4, 5, 6],
  },
  {
    mode: 'intensive-bootcamp',
    label: 'Intensive Career Switch',
    subtitle: 'Mon–Sat · 90 mins/day · 19:00 (Accelerated skill mastery)',
    dailyMinutesTarget: 90,
    preferredTime: '19:00',
    studyDays: [1, 2, 3, 4, 5, 6],
  },
  {
    mode: 'exam-prep',
    label: 'Certification & Core Prep',
    subtitle: 'Daily · 75 mins/day · 18:30 (Structured concept & practice drills)',
    dailyMinutesTarget: 75,
    preferredTime: '18:30',
    studyDays: [0, 1, 2, 3, 4, 5, 6],
  },
];

export function createDefaultLearnerProfile(role: LearnerRole = 'Software Engineer'): LearnerProfile {
  const roleConfig =
    LEARNER_ROLE_OPTIONS.find(r => r.role === role) || LEARNER_ROLE_OPTIONS[0];
  const pacingConfig =
    PACING_PRESETS.find(p => p.mode === roleConfig.defaultPacing) || PACING_PRESETS[0];

  const weeklyHoursGoal = Math.max(
    1,
    Math.round(((pacingConfig.dailyMinutesTarget * pacingConfig.studyDays.length) / 60) * 10) / 10
  );

  return {
    name: 'Alex Rivera',
    role: roleConfig.role,
    careerObjective: roleConfig.defaultObjective,
    pacingMode: pacingConfig.mode,
    dailyMinutesTarget: pacingConfig.dailyMinutesTarget,
    preferredTime: pacingConfig.preferredTime,
    studyDays: [...pacingConfig.studyDays],
    weeklyHoursGoal,
  };
}

export function applyPacingPresetToProfile(
  profile: LearnerProfile,
  pacingMode: PacingMode
): LearnerProfile {
  const preset = PACING_PRESETS.find(p => p.mode === pacingMode) || PACING_PRESETS[0];
  const weeklyHoursGoal = Math.max(
    1,
    Math.round(((preset.dailyMinutesTarget * preset.studyDays.length) / 60) * 10) / 10
  );

  return {
    ...profile,
    pacingMode: preset.mode,
    dailyMinutesTarget: preset.dailyMinutesTarget,
    preferredTime: preset.preferredTime,
    studyDays: [...preset.studyDays],
    weeklyHoursGoal,
  };
}

export function applyProfilePacingToTracker(
  tracker: Tracker,
  profile: LearnerProfile
): Tracker {
  return {
    ...tracker,
    dailyMinutesTarget: profile.dailyMinutesTarget,
    scheduledTime: profile.preferredTime,
    studyDays: profile.studyDays.length > 0 ? [...profile.studyDays] : [1, 2, 3, 4, 5],
  };
}

export function computeSkillMilestones(
  tracker: Tracker | null,
  profile: LearnerProfile,
  streakDays: number
): SkillMilestone[] {
  const progress = calculateCourseProgress(tracker);
  const allLessons = tracker ? tracker.modules.flatMap(m => m.lessons) : [];
  const notesWrittenCount = allLessons.filter(l => l.notes && l.notes.trim().length > 5).length;
  const appliedProgress =
    allLessons.length > 0
      ? Math.min(100, Math.round(((progress.completed + notesWrittenCount) / allLessons.length) * 100))
      : 0;
  const consistencyPercent = Math.min(100, Math.round((streakDays / 7) * 100));

  const pacingLabel =
    PACING_PRESETS.find(p => p.mode === profile.pacingMode)?.label || 'Custom Pacing';

  return [
    {
      id: 'milestone-skill-mastery',
      title: `Core Skill Mastery: ${tracker?.category || 'Technical Track'}`,
      categoryLabel: `${profile.role} · Skill Execution`,
      progressPercent: progress.percent,
      completed: progress.percent >= 100,
      targetDescription: `${progress.completed}/${progress.total} lectures completed toward "${profile.careerObjective}"`,
    },
    {
      id: 'milestone-applied-execution',
      title: 'Applied Implementation & Knowledge Retention',
      categoryLabel: `${profile.role} · Practical Output`,
      progressPercent: appliedProgress,
      completed: appliedProgress >= 100,
      targetDescription: `Hands-on exercises & documented takeaways across ${tracker?.title || 'active track'}`,
    },
    {
      id: 'milestone-pacing-consistency',
      title: `${pacingLabel} Habit (${profile.weeklyHoursGoal}h / week target)`,
      categoryLabel: `${profile.role} · Pacing Consistency`,
      progressPercent: consistencyPercent,
      completed: streakDays >= 7,
      targetDescription: `${streakDays}/7 consecutive active sessions logged at ${profile.preferredTime}`,
    },
  ];
}

// ============================================================================
// Profile Course Analytics & History Breakdown
// ============================================================================

export function analyzeSingleCourseStatus(tracker: Tracker): CourseAnalyticsItem {
  const allLessons: Array<{ lesson: Lesson; moduleTitle: string }> = [];
  for (const mod of tracker.modules || []) {
    for (const les of mod.lessons || []) {
      allLessons.push({ lesson: les, moduleTitle: mod.title });
    }
  }

  const totalLessonsCount = allLessons.length;
  const completedEntries = allLessons.filter(e => e.lesson.completed);
  const completedLessonsCount = completedEntries.length;

  const progressPercent =
    totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

  let status: CourseStatusCategory = 'pending';
  if (totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount) {
    status = 'completed';
  } else if (completedLessonsCount > 0) {
    status = 'in_progress';
  }

  const minutesLogged = completedEntries.reduce(
    (sum, e) => sum + (e.lesson.durationMinutes || 35),
    0
  );
  const estimatedTotalMinutes =
    allLessons.reduce((sum, e) => sum + (e.lesson.durationMinutes || 35), 0) ||
    tracker.estimatedTotalMinutes ||
    0;

  const hoursLogged = Math.round((minutesLogged / 60) * 10) / 10;
  const estimatedTotalHours = Math.round((estimatedTotalMinutes / 60) * 10) / 10;

  let completedAt: string | undefined;
  if (status === 'completed') {
    const timestamps = completedEntries
      .map(e => e.lesson.completedAt)
      .filter((t): t is string => Boolean(t))
      .sort();
    completedAt = timestamps[timestamps.length - 1] || tracker.createdAt;
  }

  const firstUncompleted = allLessons.find(e => !e.lesson.completed);
  const lastLesson = allLessons[allLessons.length - 1];

  const currentLessonTitle =
    status === 'completed'
      ? lastLesson?.lesson.title || 'All Lectures Completed'
      : firstUncompleted?.lesson.title || 'Lesson 1';

  const currentModuleTitle =
    status === 'completed'
      ? lastLesson?.moduleTitle || 'Course Completed'
      : firstUncompleted?.moduleTitle || tracker.modules[0]?.title || 'Module 1';

  return {
    trackerId: tracker.id,
    title: tracker.title,
    category: tracker.category,
    difficulty: tracker.difficulty,
    instructor: tracker.instructor,
    sourceUrl: tracker.sourceUrl,
    status,
    completedLessonsCount,
    totalLessonsCount,
    progressPercent,
    minutesLogged,
    estimatedTotalMinutes,
    hoursLogged,
    estimatedTotalHours,
    completedAt,
    currentLessonTitle,
    currentModuleTitle,
    createdAt: tracker.createdAt,
  };
}

export function computeProfileCourseAnalytics(
  trackers: Tracker[]
): ProfileCourseAnalyticsSummary {
  const allCourses = (trackers || []).map(t => analyzeSingleCourseStatus(t));
  const completedCourses = allCourses.filter(c => c.status === 'completed');
  const inProgressCourses = allCourses.filter(c => c.status === 'in_progress');
  const pendingCourses = allCourses.filter(c => c.status === 'pending');

  const totalMinutesLogged = allCourses.reduce((sum, c) => sum + c.minutesLogged, 0);
  const totalHoursLogged = Math.round((totalMinutesLogged / 60) * 10) / 10;

  const totalLessonsCompleted = allCourses.reduce((sum, c) => sum + c.completedLessonsCount, 0);
  const totalLessonsAvailable = allCourses.reduce((sum, c) => sum + c.totalLessonsCount, 0);

  const overallCompletionPercent =
    totalLessonsAvailable > 0
      ? Math.round((totalLessonsCompleted / totalLessonsAvailable) * 100)
      : 0;

  return {
    totalCourses: allCourses.length,
    completedCount: completedCourses.length,
    inProgressCount: inProgressCourses.length,
    pendingCount: pendingCourses.length,
    totalMinutesLogged,
    totalHoursLogged,
    totalLessonsCompleted,
    totalLessonsAvailable,
    overallCompletionPercent,
    completedCourses,
    inProgressCourses,
    pendingCourses,
    allCourses,
  };
}

export function markEntireCourseCompleted(
  tracker: Tracker,
  completionTimestamp: string = new Date().toISOString()
): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => ({
        ...les,
        completed: true,
        completedAt: les.completed && les.completedAt ? les.completedAt : completionTimestamp,
      })),
    })),
  };
}

export function resetCourseToPending(tracker: Tracker): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => ({
        ...les,
        completed: false,
        completedAt: undefined,
      })),
    })),
  };
}

// ============================================================================
// 1. SMART LEARNING PROGRESS & CONTINUE LEARNING
// ============================================================================

/**
 * Records the last watched lesson ID and access timestamp on a course tracker.
 */
export function recordLastWatchedLesson(
  tracker: Tracker,
  lessonId: string,
  accessedAtIso: string = new Date().toISOString()
): Tracker {
  return {
    ...tracker,
    lastWatchedLessonId: lessonId,
    lastAccessedAt: accessedAtIso,
  };
}

/**
 * Returns the previous and next lesson relative to the current lesson ID in the tracker.
 */
export function getPreviousAndNextLesson(
  tracker: Tracker | null,
  currentLessonId?: string | null
): {
  previousLesson: Lesson | null;
  nextLesson: Lesson | null;
  currentIndex: number;
  totalCount: number;
} {
  if (!tracker) {
    return { previousLesson: null, nextLesson: null, currentIndex: 0, totalCount: 0 };
  }
  const allLessons = tracker.modules.flatMap(m => m.lessons);
  if (allLessons.length === 0) {
    return { previousLesson: null, nextLesson: null, currentIndex: 0, totalCount: 0 };
  }

  const active = getActiveOrSelectedLesson(
    tracker,
    currentLessonId || tracker.lastWatchedLessonId || null
  );
  const idx = active.lessonIndex;

  return {
    previousLesson: idx > 0 ? allLessons[idx - 1] : null,
    nextLesson: idx < allLessons.length - 1 ? allLessons[idx + 1] : null,
    currentIndex: idx,
    totalCount: allLessons.length,
  };
}

/**
 * Builds the ContinueLearningInfo descriptor for a single course tracker,
 * remembering `lastWatchedLessonId` when present or defaulting to the next uncompleted lesson.
 */
export function getContinueLearningInfoForTracker(
  tracker: Tracker | null
): ContinueLearningInfo | null {
  if (!tracker) return null;
  const allEntries: Array<{ lesson: Lesson; index: number; moduleTitle: string }> = [];
  let runningIdx = 0;
  for (const mod of tracker.modules || []) {
    for (const les of mod.lessons || []) {
      allEntries.push({
        lesson: les,
        index: runningIdx++,
        moduleTitle: mod.title,
      });
    }
  }
  if (allEntries.length === 0) return null;

  const totalLessons = allEntries.length;
  const completedLessons = allEntries.filter(e => e.lesson.completed).length;
  const pendingLessons = Math.max(0, totalLessons - completedLessons);
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  let targetEntry = tracker.lastWatchedLessonId
    ? allEntries.find(e => e.lesson.id === tracker.lastWatchedLessonId)
    : undefined;

  // If the remembered lesson was already completed and there is a subsequent uncompleted lesson,
  // or if no lastWatchedLessonId was stored, resolve to the first uncompleted lesson (or last lesson)
  if (!targetEntry) {
    targetEntry = allEntries.find(e => !e.lesson.completed) || allEntries[allEntries.length - 1];
  }

  return {
    trackerId: tracker.id,
    trackerTitle: tracker.title,
    category: tracker.category,
    instructor: tracker.instructor,
    lessonId: targetEntry.lesson.id,
    lessonTitle: targetEntry.lesson.title,
    lessonIndex: targetEntry.index,
    totalLessons,
    completedLessons,
    pendingLessons,
    progressPercent,
    moduleTitle: targetEntry.moduleTitle,
    lastAccessedAt: tracker.lastAccessedAt || tracker.createdAt || new Date(0).toISOString(),
  };
}

/**
 * Computes the global Continue Learning state across all saved courses,
 * prioritizing the most recently accessed or active course.
 */
export function getContinueLearningState(
  trackers: Tracker[],
  activeTrackerId?: string
): {
  primaryContinue: ContinueLearningInfo | null;
  recentlyAccessed: ContinueLearningInfo[];
} {
  const infos = (trackers || [])
    .map(t => getContinueLearningInfoForTracker(t))
    .filter((info): info is ContinueLearningInfo => Boolean(info));

  if (infos.length === 0) {
    return { primaryContinue: null, recentlyAccessed: [] };
  }

  // Sort by explicit lastAccessedAt descending, then in-progress status, then activeTrackerId
  const sorted = [...infos].sort((a, b) => {
    const trackerA = trackers.find(t => t.id === a.trackerId);
    const trackerB = trackers.find(t => t.id === b.trackerId);
    const hasAccessA = Boolean(trackerA?.lastAccessedAt);
    const hasAccessB = Boolean(trackerB?.lastAccessedAt);

    if (hasAccessA && hasAccessB) {
      return b.lastAccessedAt.localeCompare(a.lastAccessedAt);
    }
    if (hasAccessA !== hasAccessB) {
      return hasAccessA ? -1 : 1;
    }
    if (activeTrackerId) {
      if (a.trackerId === activeTrackerId && b.trackerId !== activeTrackerId) return -1;
      if (b.trackerId === activeTrackerId && a.trackerId !== activeTrackerId) return 1;
    }
    return b.lastAccessedAt.localeCompare(a.lastAccessedAt);
  });

  return {
    primaryContinue: sorted[0] || null,
    recentlyAccessed: sorted,
  };
}

// ============================================================================
// 2. PERSONAL NOTES (TIMESTAMP-BASED NOTES, BOOKMARKS, SEARCH, EDIT, EXPORT)
// ============================================================================

/**
 * Formats seconds into MM:SS or HH:MM:SS (e.g., 270 -> "04:30", 3665 -> "01:01:05").
 */
export function formatSecondsToTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Parses a timestamp string ("04:30", "1:02:15", "2m30s", "90") or number into total seconds.
 */
export function parseTimestampToSeconds(raw: string | number | undefined): number {
  if (typeof raw === 'number') {
    return Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
  }
  const str = String(raw || '').trim();
  if (!str) return 0;

  if (/^\d+$/.test(str)) {
    return Math.max(0, parseInt(str, 10));
  }

  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.some(p => !Number.isFinite(p) || p < 0)) return 0;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  return parseYouTubeTimestampParam(str);
}

/**
 * Normalizes legacy string `lesson.notes` and structured `lesson.noteItems` into a unified sorted list.
 */
export function getStructuredNotesForLesson(
  lesson: Lesson | null | undefined,
  trackerId: string = ''
): VideoNoteItem[] {
  if (!lesson) return [];
  const rawItems: VideoNoteItem[] = Array.isArray(lesson.noteItems) ? [...lesson.noteItems] : [];
  const hasStructuredNote = rawItems.some(item => !item.id.startsWith('legacy-note-'));
  const items = hasStructuredNote
    ? rawItems.filter(
        item =>
          !item.id.startsWith('legacy-note-') ||
          (!/^\[\d{2}:\d{2}/.test(item.content.trim()) &&
            !rawItems.some(
              other =>
                other.id !== item.id &&
                item.content.toLowerCase().includes(other.content.toLowerCase())
            ))
      )
    : rawItems;

  // If legacy `lesson.notes` exists and `noteItems` has not been populated yet, include it seamlessly
  if (items.length === 0 && lesson.notes && lesson.notes.trim().length > 0) {
    items.push({
      id: `legacy-note-${lesson.id}`,
      lessonId: lesson.id,
      trackerId,
      content: lesson.notes.trim(),
      timestampSeconds: 0,
      formattedTimestamp: '00:00',
      isBookmarked: false,
      conceptTag: lesson.keyConcepts?.[0] || 'Takeaway',
      createdAt: lesson.completedAt || '2026-01-01T00:00:00.000Z',
      updatedAt: lesson.completedAt || '2026-01-01T00:00:00.000Z',
    });
  }

  return items.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

/**
 * Adds a timestamp-based personal note to a specific lesson in a Tracker.
 */
export function addVideoNoteToTracker(
  tracker: Tracker,
  params: {
    lessonId: string;
    content: string;
    timestampInput?: string | number;
    isBookmarked?: boolean;
    conceptTag?: string;
    noteId?: string;
    nowIso?: string;
  }
): Tracker {
  const trimmedContent = (params.content || '').trim();
  if (!trimmedContent) return tracker;

  const timestampSeconds = parseTimestampToSeconds(params.timestampInput);
  const formattedTimestamp = formatSecondsToTimestamp(timestampSeconds);
  const nowIso = params.nowIso || new Date().toISOString();

  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id !== params.lessonId) return les;
        const existingItems = getStructuredNotesForLesson(les, tracker.id);
        const newNote: VideoNoteItem = {
          id: params.noteId || `vnote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          lessonId: les.id,
          trackerId: tracker.id,
          content: trimmedContent,
          timestampSeconds,
          formattedTimestamp,
          isBookmarked: Boolean(params.isBookmarked),
          conceptTag: (params.conceptTag || les.keyConcepts?.[0] || 'Core Concept').trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const updatedItems = [...existingItems, newNote].sort(
          (a, b) => a.timestampSeconds - b.timestampSeconds
        );
        return {
          ...les,
          noteItems: updatedItems,
          notes: updatedItems.map(n => `[${n.formattedTimestamp}] ${n.content}`).join('\n'),
        };
      }),
    })),
  };
}

/**
 * Updates an existing timestamp-based note in a Tracker.
 */
export function updateVideoNoteInTracker(
  tracker: Tracker,
  params: {
    lessonId: string;
    noteId: string;
    content: string;
    timestampInput?: string | number;
    isBookmarked?: boolean;
    conceptTag?: string;
    nowIso?: string;
  }
): Tracker {
  const trimmedContent = (params.content || '').trim();
  if (!trimmedContent) return tracker;
  const nowIso = params.nowIso || new Date().toISOString();

  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id !== params.lessonId) return les;
        const existingItems = getStructuredNotesForLesson(les, tracker.id);
        const updatedItems = existingItems
          .map(item => {
            if (item.id !== params.noteId) return item;
            const nextSec =
              params.timestampInput !== undefined
                ? parseTimestampToSeconds(params.timestampInput)
                : item.timestampSeconds;
            return {
              ...item,
              content: trimmedContent,
              timestampSeconds: nextSec,
              formattedTimestamp: formatSecondsToTimestamp(nextSec),
              isBookmarked:
                params.isBookmarked !== undefined ? params.isBookmarked : item.isBookmarked,
              conceptTag:
                params.conceptTag !== undefined ? params.conceptTag.trim() : item.conceptTag,
              updatedAt: nowIso,
            };
          })
          .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

        return {
          ...les,
          noteItems: updatedItems,
          notes: updatedItems.map(n => `[${n.formattedTimestamp}] ${n.content}`).join('\n'),
        };
      }),
    })),
  };
}

/**
 * Deletes a personal note from a lesson in a Tracker.
 */
export function deleteVideoNoteFromTracker(
  tracker: Tracker,
  lessonId: string,
  noteId: string
): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id !== lessonId) return les;
        const existingItems = getStructuredNotesForLesson(les, tracker.id);
        const updatedItems = existingItems.filter(item => item.id !== noteId);
        return {
          ...les,
          noteItems: updatedItems,
          notes:
            updatedItems.length > 0
              ? updatedItems.map(n => `[${n.formattedTimestamp}] ${n.content}`).join('\n')
              : undefined,
        };
      }),
    })),
  };
}

/**
 * Toggles the concept bookmark flag (`isBookmarked`) on a personal video note.
 */
export function toggleBookmarkVideoNoteInTracker(
  tracker: Tracker,
  lessonId: string,
  noteId: string
): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id !== lessonId) return les;
        const existingItems = getStructuredNotesForLesson(les, tracker.id);
        const updatedItems = existingItems.map(item =>
          item.id === noteId ? { ...item, isBookmarked: !item.isBookmarked } : item
        );
        return {
          ...les,
          noteItems: updatedItems,
        };
      }),
    })),
  };
}

export interface EnrichedCourseNote extends VideoNoteItem {
  lessonTitle: string;
  lessonIndex: number;
  moduleTitle: string;
}

/**
 * Searches and filters notes across a single lesson or an entire course tracker.
 */
export function searchAndFilterCourseNotes(
  tracker: Tracker | null,
  options?: {
    lessonId?: string;
    searchQuery?: string;
    onlyBookmarked?: boolean;
    conceptTag?: string;
  }
): EnrichedCourseNote[] {
  if (!tracker) return [];
  const results: EnrichedCourseNote[] = [];
  let runningIdx = 0;

  for (const mod of tracker.modules || []) {
    for (const les of mod.lessons || []) {
      const idx = runningIdx++;
      if (options?.lessonId && les.id !== options.lessonId) {
        continue;
      }
      const notes = getStructuredNotesForLesson(les, tracker.id);
      for (const note of notes) {
        results.push({
          ...note,
          lessonTitle: les.title,
          lessonIndex: idx,
          moduleTitle: mod.title,
        });
      }
    }
  }

  const query = (options?.searchQuery || '').trim().toLowerCase();
  const tagFilter = (options?.conceptTag || '').trim().toLowerCase();

  return results.filter(item => {
    if (options?.onlyBookmarked && !item.isBookmarked) return false;
    if (tagFilter && (item.conceptTag || '').toLowerCase() !== tagFilter) return false;
    if (query) {
      const hay = `${item.content} ${item.conceptTag || ''} ${item.lessonTitle} ${item.formattedTimestamp}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

/**
 * Exports personal notes for a lesson or entire course to clean Markdown format.
 */
export function exportCourseNotesToMarkdown(
  tracker: Tracker,
  options?: { lessonId?: string; onlyBookmarked?: boolean }
): string {
  const notes = searchAndFilterCourseNotes(tracker, {
    lessonId: options?.lessonId,
    onlyBookmarked: options?.onlyBookmarked,
  });

  const lines: string[] = [
    `# Study Notes: ${tracker.title}`,
    `- **Category:** ${tracker.category}`,
    `- **Instructor:** ${tracker.instructor}`,
    `- **Total Notes Exported:** ${notes.length}`,
    '',
  ];

  if (notes.length === 0) {
    lines.push('_No study notes recorded yet._');
    return lines.join('\n');
  }

  const groupedByLesson = new Map<string, EnrichedCourseNote[]>();
  for (const note of notes) {
    const key = `${note.lessonIndex + 1}. ${note.lessonTitle}`;
    const list = groupedByLesson.get(key) || [];
    list.push(note);
    groupedByLesson.set(key, list);
  }

  for (const [lessonHeader, lessonNotes] of groupedByLesson.entries()) {
    lines.push(`## ${lessonHeader}`);
    for (const n of lessonNotes) {
      const bookmarkBadge = n.isBookmarked ? ' [BOOKMARKED]' : '';
      const conceptBadge = n.conceptTag ? ` (${n.conceptTag})` : '';
      lines.push(`- **[${n.formattedTimestamp}]**${bookmarkBadge}${conceptBadge}: ${n.content}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exports personal notes for a lesson or entire course to structured JSON format.
 */
export function exportCourseNotesToJson(
  tracker: Tracker,
  options?: { lessonId?: string; onlyBookmarked?: boolean }
): string {
  const notes = searchAndFilterCourseNotes(tracker, {
    lessonId: options?.lessonId,
    onlyBookmarked: options?.onlyBookmarked,
  });

  return JSON.stringify(
    {
      courseId: tracker.id,
      courseTitle: tracker.title,
      category: tracker.category,
      instructor: tracker.instructor,
      exportedAt: new Date().toISOString(),
      totalNotes: notes.length,
      notes,
    },
    null,
    2
  );
}

// ============================================================================
// 3. ADVANCED COURSE LIBRARY (SEARCH, FILTER, SORT, CATEGORIZE, FAVORITES)
// ============================================================================

/**
 * Normalizes a course's difficulty string into one of the 3 standard filter buckets:
 * 'Beginner' | 'Intermediate' | 'Advanced'.
 */
export function categorizeCourseDifficulty(
  rawDifficulty?: string
): 'Beginner' | 'Intermediate' | 'Advanced' {
  const lower = (rawDifficulty || '').toLowerCase();
  if (lower.includes('advanced') && !lower.includes('beginner')) {
    return 'Advanced';
  }
  if (lower.includes('intermediate')) {
    return 'Intermediate';
  }
  if (lower.includes('beginner')) {
    return 'Beginner';
  }
  return 'Intermediate';
}

/**
 * Infers technology tags for a course from its explicit `technologies` array,
 * title, category, description, and lesson concepts.
 */
export function inferCourseTechnologies(tracker: Tracker): string[] {
  if (Array.isArray(tracker.technologies) && tracker.technologies.length > 0) {
    return tracker.technologies;
  }

  const combined = `${tracker.title} ${tracker.category} ${tracker.description} ${tracker.modules
    .flatMap(m => m.lessons.flatMap(l => [l.title, ...(l.keyConcepts || [])]))
    .join(' ')}`.toLowerCase();

  const catalog: Array<{ label: string; pattern: RegExp }> = [
    { label: 'C++', pattern: /\bc\+\+|\bcpp\b|\bstl\b/i },
    { label: 'Python', pattern: /\bpython\b|\bdjango\b|\bflask\b|\bpandas\b/i },
    { label: 'JavaScript', pattern: /\bjavascript\b|\bes6\b|\bjs\b/i },
    { label: 'TypeScript', pattern: /\btypescript\b|\bts\b/i },
    { label: 'React', pattern: /\breact\b|\bnext\.?js\b|\bredux\b/i },
    { label: 'Node.js', pattern: /\bnode\.?js\b|\bexpress\b|\bmern\b/i },
    { label: 'SQL', pattern: /\bsql\b|\bmysql\b|\bpostgres|\bdbms\b|\bdatabase\b/i },
    { label: 'Java', pattern: /\bjava\b|\bspring\b/i },
    { label: 'Docker & K8s', pattern: /\bdocker\b|\bkubernetes\b|\bcontainer/i },
    { label: 'Linux & OS', pattern: /\blinux\b|\boperating system|\bkernel\b|\bcpu scheduling/i },
    { label: 'Machine Learning', pattern: /\bmachine learning\b|\bdeep learning\b|\bneural\b|\bllm\b/i },
    { label: 'Algorithms', pattern: /\balgorithm|\bdata structure|\bdsa\b|\bleetcode/i },
    { label: 'System Design', pattern: /\bsystem design|\bmicroservice|\bdistributed|\bscalab/i },
  ];

  const matched = catalog.filter(item => item.pattern.test(combined)).map(item => item.label);
  return matched.length > 0 ? matched.slice(0, 5) : [tracker.category || 'Software Engineering'];
}

/**
 * Toggles the `isFavorite` flag on a course tracker.
 */
export function toggleTrackerFavorite(tracker: Tracker): Tracker {
  return {
    ...tracker,
    isFavorite: !tracker.isFavorite,
  };
}

/**
 * Toggles the `isBookmarked` flag on a course tracker.
 */
export function toggleTrackerBookmark(tracker: Tracker): Tracker {
  return {
    ...tracker,
    isBookmarked: !tracker.isBookmarked,
  };
}

/**
 * Filters and sorts saved courses in the Advanced Course Library.
 */
export function filterAndSortTrackers(
  trackers: Tracker[],
  options: CourseLibraryFilterOptions = {}
): Tracker[] {
  const query = (options.searchQuery || '').trim().toLowerCase();
  const categoryFilter = (options.category || '').trim().toLowerCase();
  const difficultyFilter = (options.difficulty || '').trim().toLowerCase();
  const techFilter = (options.technology || '').trim().toLowerCase();
  const sortBy: CourseSortOption = options.sortBy || 'recently_added';

  const filtered = (trackers || []).filter(tracker => {
    if (options.onlyFavorites && !tracker.isFavorite) return false;
    if (options.onlyBookmarked && !tracker.isBookmarked) return false;

    if (categoryFilter && categoryFilter !== 'all') {
      if ((tracker.category || '').toLowerCase() !== categoryFilter) return false;
    }

    if (difficultyFilter && difficultyFilter !== 'all') {
      const normalizedDiff = categorizeCourseDifficulty(tracker.difficulty).toLowerCase();
      const rawDiff = (tracker.difficulty || '').toLowerCase();
      if (normalizedDiff !== difficultyFilter && !rawDiff.includes(difficultyFilter)) {
        return false;
      }
    }

    if (techFilter && techFilter !== 'all') {
      const techs = inferCourseTechnologies(tracker).map(t => t.toLowerCase());
      if (!techs.some(t => t === techFilter || t.includes(techFilter))) {
        return false;
      }
    }

    if (query) {
      const techs = inferCourseTechnologies(tracker).join(' ');
      const lessonTitles = tracker.modules
        .flatMap(m => m.lessons.map(l => l.title))
        .join(' ');
      const hay = `${tracker.title} ${tracker.description} ${tracker.instructor} ${tracker.category} ${techs} ${lessonTitles}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'completion') {
      const progA = calculateCourseProgress(a).percent;
      const progB = calculateCourseProgress(b).percent;
      if (progB !== progA) return progB - progA;
      return a.title.localeCompare(b.title);
    }
    // Default: 'recently_added' (uses createdAt or lastAccessedAt descending)
    const dateA = a.lastAccessedAt || a.createdAt || '';
    const dateB = b.lastAccessedAt || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

// ============================================================================
// 4. STUDENT DASHBOARD & WEEKLY LEARNING ACTIVITY
// ============================================================================

/**
 * Computes a 7-day weekly learning activity breakdown ending on `referenceDateIso` (defaults to today).
 * Combines explicit `dailyLogs` with lessons completed on each date so real completions are reflected.
 */
export function computeWeeklyLearningActivity(
  trackers: Tracker[],
  dailyLogs: DailyLogEntry[] = [],
  dailyTargetMinutes: number = 60,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): WeeklyActivityDay[] {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const refDate = new Date(`${referenceDateIso.slice(0, 10)}T12:00:00.000Z`);
  const days: WeeklyActivityDay[] = [];

  // Map completed lessons by YYYY-MM-DD date
  const lessonMinutesByDate = new Map<string, { minutes: number; count: number }>();
  for (const tracker of trackers || []) {
    for (const mod of tracker.modules || []) {
      for (const les of mod.lessons || []) {
        if (les.completed && les.completedAt) {
          const dateKey = les.completedAt.slice(0, 10);
          const current = lessonMinutesByDate.get(dateKey) || { minutes: 0, count: 0 };
          current.minutes += les.durationMinutes || 35;
          current.count += 1;
          lessonMinutesByDate.set(dateKey, current);
        }
      }
    }
  }

  // Map explicit daily logs by YYYY-MM-DD
  const logByDate = new Map<string, DailyLogEntry>();
  for (const log of dailyLogs || []) {
    if (log && log.date) {
      logByDate.set(log.date.slice(0, 10), log);
    }
  }

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(refDate.getTime() - offset * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    const dayLabel = dayNames[d.getUTCDay()];

    const fromLessons = lessonMinutesByDate.get(dateKey) || { minutes: 0, count: 0 };
    const fromLog = logByDate.get(dateKey);

    const minutesStudied = Math.max(fromLessons.minutes, fromLog?.minutesStudied || 0);
    const lessonsCompleted = Math.max(fromLessons.count, fromLog?.lessonsCompletedCount || 0);

    days.push({
      date: dateKey,
      dayLabel,
      minutesStudied,
      lessonsCompleted,
      targetMinutes: dailyTargetMinutes,
      goalMet: minutesStudied >= dailyTargetMinutes || lessonsCompleted > 0,
    });
  }

  return days;
}

/**
 * Computes the complete Student Dashboard metrics summary:
 * - Total enrolled courses
 * - Total completed lessons & pending lessons
 * - Overall learning progress percentage
 * - Current learning streak
 * - Continue Learning & Recently accessed courses
 * - Weekly learning activity
 */
export function computeStudentDashboardSummary(
  trackers: Tracker[],
  dailyLogs: DailyLogEntry[] = [],
  streakDays: number = 1,
  dailyTargetMinutes: number = 60,
  activeTrackerId?: string,
  referenceDateIso?: string
): StudentDashboardSummary {
  const safeTrackers = trackers || [];
  const totalEnrolledCourses = safeTrackers.length;

  let totalCompletedLessons = 0;
  let totalAvailableLessons = 0;
  let bookmarkedNotesCount = 0;

  for (const tracker of safeTrackers) {
    for (const mod of tracker.modules || []) {
      for (const les of mod.lessons || []) {
        totalAvailableLessons += 1;
        if (les.completed) totalCompletedLessons += 1;
        const notes = getStructuredNotesForLesson(les, tracker.id);
        bookmarkedNotesCount += notes.filter(n => n.isBookmarked).length;
      }
    }
  }

  const totalPendingLessons = Math.max(0, totalAvailableLessons - totalCompletedLessons);
  const overallProgressPercent =
    totalAvailableLessons > 0
      ? Math.round((totalCompletedLessons / totalAvailableLessons) * 100)
      : 0;

  const { primaryContinue, recentlyAccessed } = getContinueLearningState(
    safeTrackers,
    activeTrackerId
  );

  const weeklyActivity = computeWeeklyLearningActivity(
    safeTrackers,
    dailyLogs,
    dailyTargetMinutes,
    referenceDateIso
  );
  const totalWeeklyMinutes = weeklyActivity.reduce((sum, d) => sum + d.minutesStudied, 0);
  const favoriteCoursesCount = safeTrackers.filter(t => t.isFavorite).length;

  return {
    totalEnrolledCourses,
    totalCompletedLessons,
    totalPendingLessons,
    totalAvailableLessons,
    overallProgressPercent,
    currentStreakDays: streakDays,
    continueLearning: primaryContinue,
    recentlyAccessedCourses: recentlyAccessed,
    weeklyActivity,
    totalWeeklyMinutes,
    favoriteCoursesCount,
    bookmarkedNotesCount,
  };
}

// ============================================================================
// 5. USER-SPECIFIC DATA ISOLATION & DELETION HELPERS
// ============================================================================

/**
 * Generates a user-isolated storage key so multiple learner accounts on the same browser
 * or backend stay cleanly separated while preserving backward compatibility for the default user.
 */
export function getUserScopedStorageKey(
  userId: string | undefined,
  baseKey: string
): string {
  const cleanUser = (userId || '').trim();
  if (!cleanUser || cleanUser === 'default-learner') {
    return baseKey;
  }
  return `${baseKey}__user_${cleanUser.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/**
 * Deletes a single saved course from the user's course list.
 */
export function deleteTrackerFromList(
  trackers: Tracker[],
  trackerIdToDelete: string
): Tracker[] {
  return (trackers || []).filter(t => t.id !== trackerIdToDelete);
}

