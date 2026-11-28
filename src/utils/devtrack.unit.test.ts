import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveDeepWorkToggle,
  calculateCourseProgress,
  generateDailyStudyChecklist,
  filterStudyTasks,
  completeLessonInTracker,
  buildDynamicTrackerFromInput,
  resolveLessonVideoUrl,
  sanitizeAndSyncTracker,
  getCourseThemeTokens,
  buildDefaultRecapForTracker,
  LEARNER_ROLE_OPTIONS,
  PACING_PRESETS,
  createDefaultLearnerProfile,
  applyPacingPresetToProfile,
  applyProfilePacingToTracker,
  computeSkillMilestones,
  analyzeSingleCourseStatus,
  computeProfileCourseAnalytics,
  markEntireCourseCompleted,
  resetCourseToPending,
  parseYouTubeSourceUrl,
  normalizeCourseSeriesTitle,
  parseYouTubePlaylistXmlFeed,
  resolveLessonEmbedUrl,
  getActiveOrSelectedLesson,
  recordLastWatchedLesson,
  getPreviousAndNextLesson,
  getContinueLearningInfoForTracker,
  getContinueLearningState,
  formatSecondsToTimestamp,
  parseTimestampToSeconds,
  getStructuredNotesForLesson,
  addVideoNoteToTracker,
  updateVideoNoteInTracker,
  deleteVideoNoteFromTracker,
  toggleBookmarkVideoNoteInTracker,
  searchAndFilterCourseNotes,
  exportCourseNotesToMarkdown,
  exportCourseNotesToJson,
  categorizeCourseDifficulty,
  inferCourseTechnologies,
  toggleTrackerFavorite,
  toggleTrackerBookmark,
  filterAndSortTrackers,
  computeWeeklyLearningActivity,
  computeStudentDashboardSummary,
  getUserScopedStorageKey,
  deleteTrackerFromList,
  registerNewStudentProfile,
  calculateProfileCompletionReport,
  computePersonalizedCourseRecommendations,
  getAllNotesAcrossTrackers,
  groupNotesByCourseAndLecture,
  getRecentNotesForDashboard,
  updateNoteAcrossTrackers,
  deleteNoteAcrossTrackers,
  exportMultiCourseNotesToMarkdown,
  buildFormattedRevisionPdfDocument,
  sanitizePdfAsciiText,
  wrapPdfTextLines,
  createDefaultFocusTimerSettings,
  resolveFocusPhaseDurationSeconds,
  recordCompletedFocusSession,
  computeFocusSessionAnalytics,
  filterCourseLessons,
  computeLearnerNextStepRecommendation,
  computeLearnerAchievements,
  isLearnerProfileCreated,
  generateInitialsAvatarDataUrl,
  sanitizeProfileAvatarUrl,
  formatPlaylistTabLabel,
  buildInlineProfessorQuickPrompt,
  buildConceptMentorQuickPrompts,
  buildConceptMentorSystemPrompt,
  normalizeConceptMentorMode,
  METTLEWAY_BRAND_NAME,
  METTLEWAY_SCHEDULE_STORAGE_KEY,
  DEFAULT_METTLEWAY_CLASS_TIME_24,
  DEFAULT_METTLEWAY_CLASS_DURATION_MINS,
  formatTime24To12Hour,
  formatMettlewayDailyClassBadge,
  isWithinScheduledClassWindow,
  buildMettlewayDailyClassCalendarUrl,
  confirmAndLockMettlewayAlarm,
  METTLEWAY_FEEDBACK_EMAIL,
  buildMettlewayFeedbackMailtoUrl,
} from './studyWorkspaceLogic';
import {
  calculateUpcomingSessions,
  generateMultipleSessionsICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from './calendarExport';
import { buildSmartConceptFallback } from './aiMentorCache';
import { PRESET_TRACKERS } from './mockPresets';
import {
  searchYouTubeCoursePlaylists,
  searchCuratedYouTubePlaylists,
  detectSearchOrUrlMode,
  discoverYouTubePlaylist,
  sanitizeSafeHttpsUrl,
} from './youtubePlaylistDiscovery';
import { StudyTask } from '../types';

describe('Unit Tests: Deep Work Mode State Machine (TDD)', () => {
  test('enabling Deep Work from non-essential tabs (squads, curriculum, schedule) redirects to today view', () => {
    const fromSquads = resolveDeepWorkToggle(false, 'squads');
    assert.equal(fromSquads.isDeepWork, true);
    assert.equal(fromSquads.nextTab, 'today');

    const fromCurriculum = resolveDeepWorkToggle(false, 'curriculum');
    assert.equal(fromCurriculum.isDeepWork, true);
    assert.equal(fromCurriculum.nextTab, 'today');

    const fromSchedule = resolveDeepWorkToggle(false, 'schedule');
    assert.equal(fromSchedule.isDeepWork, true);
    assert.equal(fromSchedule.nextTab, 'today');
  });

  test('enabling Deep Work from essential study tabs (today, mentor) preserves the active tab', () => {
    const fromToday = resolveDeepWorkToggle(false, 'today');
    assert.equal(fromToday.isDeepWork, true);
    assert.equal(fromToday.nextTab, 'today');

    const fromMentor = resolveDeepWorkToggle(false, 'mentor');
    assert.equal(fromMentor.isDeepWork, true);
    assert.equal(fromMentor.nextTab, 'mentor');
  });

  test('disabling Deep Work exits focus mode without losing current tab', () => {
    const exitFromToday = resolveDeepWorkToggle(true, 'today');
    assert.equal(exitFromToday.isDeepWork, false);
    assert.equal(exitFromToday.nextTab, 'today');
  });
});

describe('Unit Tests: Learner Course Progress & Daily Study Task Checklist (TDD)', () => {
  test('calculateCourseProgress computes exact completed, total, and percentage', () => {
    const sampleTracker = PRESET_TRACKERS[0];
    const stats = calculateCourseProgress(sampleTracker);
    assert.ok(stats.total > 0, 'Tracker should have lessons');
    assert.equal(stats.completed, 2);
    assert.equal(stats.percent, Math.round((2 / stats.total) * 100));
  });

  test('calculateCourseProgress handles null tracker safely', () => {
    const stats = calculateCourseProgress(null);
    assert.deepEqual(stats, { completed: 0, total: 0, percent: 0 });
  });

  test('generateDailyStudyChecklist creates curriculum-synced tasks and auto-completes notes task when notes > 15 chars', () => {
    const lesson = PRESET_TRACKERS[0].modules[0].lessons[2]; // First uncompleted lesson
    const customTasks: StudyTask[] = [
      {
        id: 'custom-1',
        title: 'Dry-run Kadane algorithm on paper',
        category: 'practice',
        estimatedMinutes: 15,
        completed: true,
      },
    ];

    const checklistShortNotes = generateDailyStudyChecklist(lesson, {}, customTasks, 'short');
    assert.equal(checklistShortNotes.length, 4); // video + practice + notes + 1 custom
    const notesTaskBefore = checklistShortNotes.find(t => t.id === `notes-${lesson.id}`);
    assert.equal(notesTaskBefore?.completed, false);

    const checklistDetailedNotes = generateDailyStudyChecklist(
      lesson,
      {},
      customTasks,
      'Kadane resets running sum to 0 whenever prefix drops below 0.'
    );
    const notesTaskAfter = checklistDetailedNotes.find(t => t.id === `notes-${lesson.id}`);
    assert.equal(notesTaskAfter?.completed, true);
  });

  test('filterStudyTasks filters all, todo, and done tasks accurately', () => {
    const tasks: StudyTask[] = [
      { id: '1', title: 'Task A', category: 'video', estimatedMinutes: 30, completed: true },
      { id: '2', title: 'Task B', category: 'practice', estimatedMinutes: 20, completed: false },
      { id: '3', title: 'Task C', category: 'notes', estimatedMinutes: 10, completed: false },
    ];

    assert.equal(filterStudyTasks(tasks, 'all').length, 3);
    assert.equal(filterStudyTasks(tasks, 'done').length, 1);
    assert.equal(filterStudyTasks(tasks, 'todo').length, 2);
  });

  test('completeLessonInTracker marks target lesson completed and preserves or updates notes', () => {
    const tracker = PRESET_TRACKERS[0];
    const targetLessonId = tracker.modules[0].lessons[2].id;
    const timestamp = '2026-10-31T12:00:00.000Z';

    const updated = completeLessonInTracker(
      tracker,
      targetLessonId,
      'Mastered Dutch National Flag 3-pointer swaps',
      timestamp
    );

    const updatedLesson = updated.modules[0].lessons.find(l => l.id === targetLessonId);
    assert.equal(updatedLesson?.completed, true);
    assert.equal(updatedLesson?.completedAt, timestamp);
    assert.equal(updatedLesson?.notes, 'Mastered Dutch National Flag 3-pointer swaps');
  });
});

describe('Unit Tests: RFC 5545 ICS Calendar Export & Deep Links (TDD)', () => {
  test('calculateUpcomingSessions maps uncompleted lessons to scheduled study days', () => {
    const tracker = PRESET_TRACKERS[0];
    const sessions = calculateUpcomingSessions(tracker, {
      includeCompleted: false,
      sessionLimit: 5,
    });

    assert.equal(sessions.length, 5);
    // First uncompleted lesson in PRESET_TRACKERS[0] is lesson 3 (les-3)
    assert.equal(sessions[0].lessonId, 'les-3');
    assert.equal(sessions[0].startTime, tracker.scheduledTime);
    for (const s of sessions) {
      assert.ok(
        tracker.studyDays.includes(s.date.getDay()),
        `Session date ${s.dateString} must fall on an active study day`
      );
    }
  });

  test('generateMultipleSessionsICS outputs valid RFC 5545 VCALENDAR with VEVENT and VALARM', () => {
    const tracker = PRESET_TRACKERS[0];
    const sessions = calculateUpcomingSessions(tracker, { sessionLimit: 2 });
    const ics = generateMultipleSessionsICS(sessions, tracker.title, 15);

    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('TRIGGER:-PT15M'));
    assert.ok(ics.includes(`SUMMARY:DevTrack: ${sessions[0].lessonTitle}`));
    assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  });

  test('getGoogleCalendarUrl and getOutlookCalendarUrl generate valid deep links', () => {
    const tracker = PRESET_TRACKERS[0];
    const [session] = calculateUpcomingSessions(tracker, { sessionLimit: 1 });

    const gcalUrl = getGoogleCalendarUrl(session);
    assert.ok(gcalUrl.startsWith('https://calendar.google.com/calendar/render?'));
    assert.ok(gcalUrl.includes('action=TEMPLATE'));

    const outlookPersonal = getOutlookCalendarUrl(session, false);
    assert.ok(outlookPersonal.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?'));

    const outlook365 = getOutlookCalendarUrl(session, true);
    assert.ok(outlook365.startsWith('https://outlook.office.com/calendar/0/deeplink/compose?'));
  });
});

describe('Unit Tests: AI Concept & Technical Mentor Fallback Engine (TDD)', () => {
  test('buildSmartConceptFallback returns real-world analogy, line-by-line code, and technical deep dive', () => {
    const lesson = PRESET_TRACKERS[0].modules[0].lessons[1]; // Hashing lesson
    const simpleResult = buildSmartConceptFallback(
      PRESET_TRACKERS[0].title,
      lesson,
      'Why is unordered_map O(1) for Two Sum?',
      'DSA',
      'simple'
    );

    assert.ok(simpleResult.directAnswer.length > 20);
    assert.ok(simpleResult.realWorldAnalogy?.includes('Real-World Example:'));
    assert.equal(simpleResult.codeExample?.language, 'C++');
    assert.ok((simpleResult.codeExample?.lineByLine?.length || 0) >= 4);
    assert.equal(simpleResult.technicalDeepDive, undefined);

    const technicalResult = buildSmartConceptFallback(
      PRESET_TRACKERS[0].title,
      lesson,
      'Why is unordered_map O(1) for Two Sum?',
      'DSA',
      'technical'
    );
    assert.ok(technicalResult.technicalDeepDive?.exactDefinition.length);
    assert.ok(technicalResult.technicalDeepDive?.memoryAndExecutionBehavior.length);
    assert.ok(technicalResult.technicalDeepDive?.syntaxAndEdgeCases?.length);
  });
});

describe('Unit Tests: SEO Metadata, Visible H1, robots.txt, and sitemap.xml (TDD)', () => {
  test('index.html contains full SEO metadata targeting "Mettleway.", Open Graph tags, JSON-LD, and visible H1 with "Mettleway."', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Target keyword in title and meta description
    assert.match(html, /<title>.*Mettleway\..*<\/title>/i);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]*Mettleway\.[^"]*"/i);
    assert.match(html, /<meta\s+name="keywords"\s+content="[^"]*Mettleway\.[^"]*"/i);

    // Open Graph & Twitter tags
    assert.match(html, /<meta\s+property="og:title"\s+content="[^"]*Mettleway\.[^"]*"/i);
    assert.match(html, /<meta\s+property="og:description"\s+content="[^"]*Mettleway\.[^"]*"/i);
    assert.match(html, /<meta\s+property="og:type"\s+content="website"/i);
    assert.match(html, /<meta\s+property="og:site_name"\s+content="[^"]*Mettleway\.[^"]*"/i);
    assert.match(html, /<meta\s+name="twitter:card"\s+content="summary_large_image"/i);
    assert.match(html, /<meta\s+name="twitter:title"\s+content="[^"]*Mettleway\.[^"]*"/i);

    // Schema.org JSON-LD WebApplication
    assert.match(html, /<script\s+type="application\/ld\+json">/i);
    assert.ok(html.includes('"@type": "WebApplication"'));

    // Google Site Verification meta tag
    assert.ok(
      html.includes('<meta name="google-site-verification" content="0X0iN0C9MXiS0_ZLInyDcriTOEsujydnaBL18vhttGo" />')
    );

    // Visible H1 heading containing 'Mettleway.'
    assert.match(html, /<h1[^>]*>[\s\S]*?Mettleway\.[\s\S]*?<\/h1>/i);
  });

  test('public/robots.txt exists and allows crawlers with Sitemap reference', () => {
    const robotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
    const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
    assert.match(robotsContent, /User-agent:\s*\*/i);
    assert.match(robotsContent, /Allow:\s*\//i);
    assert.match(robotsContent, /Sitemap:\s*https?:\/\/[^\s]+\/sitemap\.xml/i);
  });

  test('public/sitemap.xml exists and contains valid XML urlset', () => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml must exist');
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    assert.ok(sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(sitemapContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(sitemapContent.includes('<loc>'));
    assert.ok(sitemapContent.includes('</urlset>'));
  });
});

describe('Unit Tests: Dynamic Course Creation, Curriculum Reset & YouTube URL Binding (TDD)', () => {
  test('buildDynamicTrackerFromInput generates a Python course with 0% progress, Python modules, and bound YouTube links (never Striver DSA fallback)', () => {
    const pythonUrl = 'https://www.youtube.com/playlist?list=PLu0W_9lII9agwh1XjRt242xIpHhPT2llg';
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: pythonUrl,
      rawTopic: 'Python Full Course for Beginners',
      dailyMinutes: 60,
      scheduledTime: '19:30',
      studyDays: [1, 2, 3, 4, 5],
      trackerId: 'tracker-python-test',
    });

    assert.equal(tracker.id, 'tracker-python-test');
    assert.ok(tracker.title.toLowerCase().includes('python'), `Expected Python title, got ${tracker.title}`);
    assert.notEqual(tracker.category, 'DSA', 'Python course should not default to DSA category');
    assert.equal(tracker.sourceUrl, pythonUrl);

    // Must start at 0% progress (no pre-completed DSA lessons!)
    const progress = calculateCourseProgress(tracker);
    assert.equal(progress.completed, 0);
    assert.equal(progress.percent, 0);
    assert.ok(progress.total >= 6);

    // Must NOT contain stale Striver DSA lesson "Lec 3: Hashing & Frequency Counting Maps"
    const allLessonTitles = tracker.modules.flatMap(m => m.lessons.map(l => l.title));
    assert.ok(
      !allLessonTitles.some(t => t.includes('Hashing & Frequency Counting Maps')),
      'Must not contain stale Striver DSA lessons'
    );
    assert.ok(
      allLessonTitles.some(t => t.toLowerCase().includes('python')),
      'Lessons must be tailored to Python'
    );

    // Every lesson videoUrl must bind to the active course YouTube playlist URL
    tracker.modules.forEach(mod => {
      mod.lessons.forEach(les => {
        assert.ok(
          les.videoUrl.includes('PLu0W_9lII9agwh1XjRt242xIpHhPT2llg'),
          `Lesson videoUrl (${les.videoUrl}) must dynamically bind to the new YouTube playlist URL`
        );
        assert.ok(
          !les.videoUrl.includes('KEs5UyBJ39g'),
          'Lesson videoUrl must never point to hardcoded Striver video'
        );
      });
    });
  });

  test('resolveLessonVideoUrl binds single YouTube video URLs, playlist URLs with index, and topic search queries', () => {
    const playlistUrl = 'https://www.youtube.com/playlist?list=PL12345';
    assert.equal(
      resolveLessonVideoUrl(playlistUrl, 'https://youtube.com/watch?v=fake', 2, 'Python Course', 'Variables'),
      'https://www.youtube.com/playlist?list=PL12345&index=3'
    );

    const singleVideoUrl = 'https://www.youtube.com/watch?v=_uQrJ0TkZlc';
    assert.equal(
      resolveLessonVideoUrl(singleVideoUrl, 'https://youtube.com/watch?v=fake', 0, 'Python Course', 'Intro'),
      'https://www.youtube.com/watch?v=_uQrJ0TkZlc'
    );

    const topicOnly = 'Python Mastery Bootcamp';
    const resolvedSearch = resolveLessonVideoUrl(topicOnly, undefined, 0, 'Python Mastery', 'Lec 1: Data Types');
    assert.ok(resolvedSearch.startsWith('https://www.youtube.com/results?search_query='));
  });

  test('sanitizeAndSyncTracker repairs a corrupted custom tracker that had stale Striver DSA modules', () => {
    const corruptedTracker = {
      ...PRESET_TRACKERS[0],
      id: 'tracker-custom-999',
      title: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc Python Tutorial',
      sourceUrl: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
    };

    const repaired = sanitizeAndSyncTracker(corruptedTracker);
    assert.equal(repaired.id, 'tracker-custom-999');
    assert.equal(calculateCourseProgress(repaired).completed, 0);
    const firstLesson = repaired.modules[0].lessons[0];
    assert.ok(!firstLesson.title.includes('Asymptotic Notations'));
    assert.equal(firstLesson.videoUrl, 'https://www.youtube.com/watch?v=_uQrJ0TkZlc');
  });

  test('getCourseThemeTokens returns distinct visual theme tokens per course category', () => {
    const dsaTheme = getCourseThemeTokens('DSA');
    const aiTheme = getCourseThemeTokens('AI & ML');
    const webTheme = getCourseThemeTokens('Web Development');
    assert.notEqual(dsaTheme.accentText, aiTheme.accentText);
    assert.notEqual(dsaTheme.progressBg, webTheme.progressBg);
  });

  test('adding a DBMS course with a YouTube playlist or first-video link dynamically updates header title, category tag, and instructor without static "Computer Science Core / YouTube Curated Series" fallback', () => {
    const firstVideoOfPlaylistUrl =
      'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y';
    const dbmsTracker = buildDynamicTrackerFromInput({
      inputUrl: firstVideoOfPlaylistUrl,
      rawTopic: 'DBMS',
      dailyMinutes: 60,
      scheduledTime: '20:00',
      studyDays: [1, 2, 3, 4, 5, 6],
      trackerId: 'tracker-dbms-test',
    });

    // 1. Dynamic Header & Subtitle Metadata assertions
    assert.ok(
      dbmsTracker.title.toUpperCase().includes('DBMS'),
      `Expected tracker title to reflect DBMS, got "${dbmsTracker.title}"`
    );
    assert.ok(
      !dbmsTracker.title.includes('Computer Science & Software Engineering Track'),
      'Must not use static Computer Science fallback title'
    );
    assert.notEqual(
      dbmsTracker.category,
      'Computer Science Core',
      'Category tag must dynamically reflect DBMS instead of static Computer Science Core'
    );
    assert.ok(
      dbmsTracker.category.toUpperCase().includes('DBMS') || dbmsTracker.category.toUpperCase().includes('DATABASE'),
      `Expected category to reflect DBMS, got "${dbmsTracker.category}"`
    );
    assert.notEqual(
      dbmsTracker.instructor,
      'YouTube Curated Series',
      'Instructor must not show static "YouTube Curated Series" fallback'
    );

    // 2. Sequential lessons (Lesson 1, Lesson 2, Lesson 3, ...)
    const allLessons = dbmsTracker.modules.flatMap(m => m.lessons);
    assert.ok(allLessons.length >= 5, 'Should generate sequential lessons for the DBMS series');
    assert.ok(allLessons[0].title.startsWith('Lesson 1:'), `Expected Lesson 1, got ${allLessons[0].title}`);
    assert.ok(allLessons[1].title.startsWith('Lesson 2:'), `Expected Lesson 2, got ${allLessons[1].title}`);
    assert.ok(allLessons[2].title.startsWith('Lesson 3:'), `Expected Lesson 3, got ${allLessons[2].title}`);

    // 3. Direct Lecture Navigation: each lesson maps to its specific index/video in the playlist
    assert.ok(
      allLessons[0].videoUrl.includes('list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y') &&
        allLessons[0].videoUrl.includes('index=1'),
      `Lesson 1 URL (${allLessons[0].videoUrl}) must map to index=1 of the playlist`
    );
    assert.ok(
      allLessons[1].videoUrl.includes('list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y') &&
        allLessons[1].videoUrl.includes('index=2'),
      `Lesson 2 URL (${allLessons[1].videoUrl}) must map to index=2 of the playlist`
    );
    assert.ok(
      allLessons[2].videoUrl.includes('list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y') &&
        allLessons[2].videoUrl.includes('index=3'),
      `Lesson 3 URL (${allLessons[2].videoUrl}) must map to index=3 of the playlist`
    );
  });

  test('direct lecture navigation for single YouTube video URL maps Lesson 2 and Lesson 3 to distinct lecture timestamps', () => {
    const singleVideoUrl = 'https://www.youtube.com/watch?v=hlGoQC332VM';
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: singleVideoUrl,
      rawTopic: 'SQL & DBMS Crash Course',
      trackerId: 'tracker-sql-single',
    });

    const allLessons = tracker.modules.flatMap(m => m.lessons);
    assert.equal(allLessons[0].videoUrl, 'https://www.youtube.com/watch?v=hlGoQC332VM');
    assert.ok(
      allLessons[1].videoUrl.includes('v=hlGoQC332VM') && allLessons[1].videoUrl.includes('t='),
      `Lesson 2 (${allLessons[1].videoUrl}) on a single-video course must include a direct timestamp parameter`
    );
    assert.ok(
      allLessons[2].videoUrl.includes('v=hlGoQC332VM') &&
        allLessons[2].videoUrl !== allLessons[1].videoUrl,
      `Lesson 3 (${allLessons[2].videoUrl}) must have a distinct timestamp from Lesson 2`
    );
  });

  test('buildDynamicTrackerFromInput maps scraped playlistVideos into sequential lessons with exact videoId watch URLs', () => {
    const playlistUrl = 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y';
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: playlistUrl,
      rawTopic: 'DBMS',
      extractedData: {
        title: 'DBMS Complete Playlist by Gate Smashers',
        instructor: 'Gate Smashers',
        playlistVideos: [
          { videoId: 'kBdlM6hNDAE', title: 'Introduction to DBMS', durationMinutes: 22 },
          { videoId: '3EJlovevfcA', title: '3-Tier Architecture in DBMS', durationMinutes: 18 },
          { videoId: 'pDX4NR4eY3A', title: 'ER Diagram & Relational Model', durationMinutes: 28 },
        ],
      },
      trackerId: 'tracker-dbms-scraped',
    });

    assert.equal(tracker.instructor, 'Gate Smashers');
    const lessons = tracker.modules.flatMap(m => m.lessons);
    assert.equal(lessons.length, 3);
    assert.equal(
      lessons[0].videoUrl,
      'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=1'
    );
    assert.equal(
      lessons[1].videoUrl,
      'https://www.youtube.com/watch?v=3EJlovevfcA&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=2'
    );
    assert.equal(
      lessons[2].videoUrl,
      'https://www.youtube.com/watch?v=pDX4NR4eY3A&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y&index=3'
    );
  });

  test('adding a watch?v=FIRST_VID&list=PLAYLIST_ID URL never repeats v=FIRST_VID on Lesson 2, Lesson 3, or subsequent lessons', () => {
    const firstVideoWithPlaylist =
      'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y';
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: firstVideoWithPlaylist,
      rawTopic: '', // Even when user leaves topic blank, auto-detect from URL!
      trackerId: 'tracker-no-repeat-test',
    });

    // Auto-detected DBMS title and instructor from URL alone
    assert.ok(
      tracker.title.toUpperCase().includes('DBMS'),
      `Expected auto-detected DBMS title from URL alone, got "${tracker.title}"`
    );

    const lessons = tracker.modules.flatMap(m => m.lessons);
    assert.ok(lessons.length >= 6);

    // Lesson 1 can use kBdlM6hNDAE, but Lesson 2, Lesson 3, etc. must NEVER repeat v=kBdlM6hNDAE
    for (let i = 1; i < lessons.length; i++) {
      assert.ok(
        !lessons[i].videoUrl.includes('v=kBdlM6hNDAE'),
        `Lesson ${i + 1} (${lessons[i].videoUrl}) must NOT repeat Lesson 1's videoId v=kBdlM6hNDAE`
      );
      assert.notEqual(
        lessons[i].videoUrl,
        lessons[0].videoUrl,
        `Lesson ${i + 1} URL must be distinct from Lesson 1 URL`
      );
    }

    // Every single lesson URL across the entire course must be unique
    const uniqueUrls = new Set(lessons.map(l => l.videoUrl));
    assert.equal(
      uniqueUrls.size,
      lessons.length,
      'Every lesson in the tracker must have its own unique YouTube URL'
    );
  });

  test('sanitizeAndSyncTracker detects and repairs a cached tracker where Lesson 1 and Lesson 2 repeat the same v= videoId', () => {
    const brokenRepeatedTracker = {
      ...PRESET_TRACKERS[0],
      id: 'tracker-broken-repeat',
      title: 'Operating Systems Full Course',
      category: 'Operating Systems',
      instructor: 'Gate Smashers',
      sourceUrl: 'https://www.youtube.com/watch?v=bkSWJJZNgf8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p',
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1: OS Basics',
          description: 'OS module',
          lessons: [
            {
              id: 'l-1',
              title: 'Lesson 1: Intro to OS',
              durationMinutes: 30,
              videoUrl: 'https://www.youtube.com/watch?v=bkSWJJZNgf8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=1',
              keyConcepts: ['Kernel'],
              practiceTask: 'Task 1',
              completed: false,
            },
            {
              id: 'l-2',
              title: 'Lesson 2: Process States',
              durationMinutes: 35,
              // BUG SIMULATION: Lesson 2 has the exact same v=bkSWJJZNgf8 as Lesson 1!
              videoUrl: 'https://www.youtube.com/watch?v=bkSWJJZNgf8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p&index=2',
              keyConcepts: ['PCB'],
              practiceTask: 'Task 2',
              completed: false,
            },
          ],
        },
      ],
    };

    const repaired = sanitizeAndSyncTracker(brokenRepeatedTracker);
    const repairedLessons = repaired.modules.flatMap(m => m.lessons);
    assert.ok(
      !repairedLessons[1].videoUrl.includes('v=bkSWJJZNgf8'),
      `Repaired Lesson 2 URL (${repairedLessons[1].videoUrl}) must not repeat Lesson 1's v=bkSWJJZNgf8`
    );
  });

  test('buildDefaultRecapForTracker generates course-specific recap and challenges instead of hardcoded DSA Big-O / Two Pointers', () => {
    const dbmsTracker = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y',
      rawTopic: 'DBMS',
      trackerId: 'tracker-dbms-recap',
    });

    const recap = buildDefaultRecapForTracker(dbmsTracker, 5);
    assert.ok(
      recap.summary.includes('DBMS'),
      `Expected recap summary to reference DBMS, got: ${recap.summary}`
    );
    assert.ok(
      !recap.summary.includes('Big-O') && !recap.summary.includes('sticky notes'),
      'Recap summary must not contain hardcoded DSA Big-O / Recursion text for a DBMS course'
    );
    assert.ok(
      !recap.practicalChallenges.some(c => c.title.includes('Reverse an Array Using Two Pointers')),
      'Recap challenges must not contain hardcoded DSA Reverse an Array challenge'
    );
  });
});

describe('Unit Tests: Repository Documentation (README.md) Verification (TDD)', () => {
  test('README.md exists and includes badges, overview, live demo link, key features, tech stack, local setup instructions, and screenshots section', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md must exist at repository root');
    const readme = fs.readFileSync(readmePath, 'utf-8');

    // Badges
    assert.match(readme, /img\.shields\.io\/badge/i, 'README.md should include Shields.io badges');
    // Overview & Live Demo Link
    assert.match(readme, /# .*DevTrack/i, 'README.md should contain main DevTrack heading');
    assert.ok(
      readme.includes('https://devtrack.ukprateek9661.workers.dev'),
      'README.md must include the permanent production live demo URL'
    );
    assert.ok(
      !readme.includes('https://ais-pre-v3bjefokcsx6kgmnh7zzm3-989611340884.asia-southeast1.run.app'),
      'README.md must not contain the old preview URL'
    );
    // Key Features
    assert.match(readme, /## .*Key Features/i);
    assert.match(readme, /Deep Work/i);
    assert.match(readme, /AI Concept Mentor/i);
    // Tech Stack (React, Vite, Tailwind CSS, Gemini API)
    assert.match(readme, /## .*Tech Stack/i);
    assert.match(readme, /React/i);
    assert.match(readme, /Vite/i);
    assert.match(readme, /Tailwind CSS/i);
    assert.match(readme, /Gemini API/i);
    // Local Setup Instructions
    assert.match(readme, /## .*(Local Setup|Getting Started|Installation)/i);
    assert.match(readme, /npm install/i);
    // Screenshots Placeholder
    assert.match(readme, /## .*Screenshots/i);
  });
});

describe('Unit Tests: Universal Learner Roles, Flexible Pacing & Skill Milestones (TDD)', () => {
  test('LEARNER_ROLE_OPTIONS supports diverse professional and learner categories beyond college students', () => {
    const roles = LEARNER_ROLE_OPTIONS.map(r => r.role);
    assert.ok(roles.includes('Software Engineer'));
    assert.ok(roles.includes('Working Professional'));
    assert.ok(roles.includes('Freelancer & Consultant'));
    assert.ok(roles.includes('Career Switcher'));
    assert.ok(roles.includes('University Student'));
    assert.ok(roles.includes('Lifelong Learner'));
  });

  test('applyPacingPresetToProfile configures after-work and weekend-sprint study schedules accurately', () => {
    const baseProfile = createDefaultLearnerProfile('Software Engineer');
    assert.equal(baseProfile.role, 'Software Engineer');

    const afterWorkProfile = applyPacingPresetToProfile(baseProfile, 'after-work');
    assert.equal(afterWorkProfile.pacingMode, 'after-work');
    assert.deepEqual(afterWorkProfile.studyDays, [1, 2, 3, 4, 5]); // Mon-Fri after office hours
    assert.equal(afterWorkProfile.dailyMinutesTarget, 45);
    assert.equal(afterWorkProfile.preferredTime, '21:00');

    const weekendProfile = applyPacingPresetToProfile(baseProfile, 'weekend-sprint');
    assert.equal(weekendProfile.pacingMode, 'weekend-sprint');
    assert.deepEqual(weekendProfile.studyDays, [0, 6]); // Sat-Sun deep-dive
    assert.equal(weekendProfile.dailyMinutesTarget, 120);
  });

  test('applyProfilePacingToTracker synchronizes custom learner pacing and daily study target with active course', () => {
    const profile = applyPacingPresetToProfile(
      createDefaultLearnerProfile('Freelancer & Consultant'),
      'after-work'
    );
    const updatedTracker = applyProfilePacingToTracker(PRESET_TRACKERS[0], profile);

    assert.equal(updatedTracker.dailyMinutesTarget, 45);
    assert.equal(updatedTracker.scheduledTime, '21:00');
    assert.deepEqual(updatedTracker.studyDays, [1, 2, 3, 4, 5]);
  });

  test('computeSkillMilestones generates universal career and skill development milestones tailored to learner role', () => {
    const proProfile = createDefaultLearnerProfile('Working Professional');
    const milestones = computeSkillMilestones(PRESET_TRACKERS[0], proProfile, 5);

    assert.equal(milestones.length, 3);
    assert.ok(
      milestones.some(m => m.categoryLabel.includes('Working Professional') || m.title.includes('Skill')),
      'Milestones must reflect universal professional/skill development'
    );
    assert.ok(
      !milestones.some(m => m.title.toLowerCase().includes('semester') || m.title.toLowerCase().includes('bca')),
      'Milestones must not contain college-only BCA/semester terms'
    );
  });
});

describe('Unit Tests: Profile Course Analytics & History Breakdown (TDD)', () => {
  test('analyzeSingleCourseStatus classifies Pending (0%), In Progress (partial), and Completed (100%) courses accurately', () => {
    // 1. Pending course (0 lessons completed)
    const pendingCourse = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX',
      rawTopic: 'System Design Architecture',
      trackerId: 'tracker-pending-test',
    });
    const pendingItem = analyzeSingleCourseStatus(pendingCourse);
    assert.equal(pendingItem.status, 'pending');
    assert.equal(pendingItem.progressPercent, 0);
    assert.equal(pendingItem.completedLessonsCount, 0);
    assert.equal(pendingItem.minutesLogged, 0);
    assert.ok(pendingItem.currentLessonTitle, 'Pending course should show first lesson milestone');

    // 2. In-Progress course (1 lesson completed)
    const firstLessonId = pendingCourse.modules[0].lessons[0].id;
    const inProgressCourse = completeLessonInTracker(
      pendingCourse,
      firstLessonId,
      'Completed Lesson 1',
      '2026-10-15T14:30:00.000Z'
    );
    const inProgressItem = analyzeSingleCourseStatus(inProgressCourse);
    assert.equal(inProgressItem.status, 'in_progress');
    assert.equal(inProgressItem.completedLessonsCount, 1);
    assert.ok(inProgressItem.progressPercent > 0 && inProgressItem.progressPercent < 100);
    assert.ok(inProgressItem.minutesLogged > 0);
    assert.equal(
      inProgressItem.currentLessonTitle,
      inProgressCourse.modules[0].lessons[1].title,
      'In-progress course should report the current uncompleted lesson milestone'
    );

    // 3. Completed course (100% lessons completed)
    const completedCourse = markEntireCourseCompleted(
      inProgressCourse,
      '2026-10-28T19:00:00.000Z'
    );
    const completedItem = analyzeSingleCourseStatus(completedCourse);
    assert.equal(completedItem.status, 'completed');
    assert.equal(completedItem.progressPercent, 100);
    assert.equal(completedItem.completedLessonsCount, completedItem.totalLessonsCount);
    assert.equal(completedItem.completedAt, '2026-10-28T19:00:00.000Z');
    assert.equal(completedItem.minutesLogged, completedItem.estimatedTotalMinutes);
  });

  test('computeProfileCourseAnalytics aggregates total courses, completed vs in-progress vs pending counts, and overall learning hours logged', () => {
    const pendingTracker = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PL_PENDING',
      rawTopic: 'Docker & Kubernetes',
      trackerId: 't-pending',
    });

    const inProgressTracker = structuredClone(PRESET_TRACKERS[0]); // 2 lessons completed (35 + 42 = 77 mins)

    const completedTracker = markEntireCourseCompleted(
      buildDynamicTrackerFromInput({
        inputUrl: 'https://www.youtube.com/playlist?list=PL_DONE',
        rawTopic: 'SQL & DBMS Mastery',
        trackerId: 't-completed',
      }),
      '2026-10-30T18:00:00.000Z'
    );

    const summary = computeProfileCourseAnalytics([
      completedTracker,
      inProgressTracker,
      pendingTracker,
    ]);

    assert.equal(summary.totalCourses, 3);
    assert.equal(summary.completedCount, 1);
    assert.equal(summary.inProgressCount, 1);
    assert.equal(summary.pendingCount, 1);
    assert.equal(summary.completedCourses.length, 1);
    assert.equal(summary.inProgressCourses.length, 1);
    assert.equal(summary.pendingCourses.length, 1);
    assert.ok(summary.totalMinutesLogged > 77, 'Should sum logged minutes across all tracks');
    assert.ok(summary.totalHoursLogged > 1, 'Should compute total learning hours across all subjects');
  });

  test('resetCourseToPending resets completed lessons to 0% pending state', () => {
    const completed = markEntireCourseCompleted(PRESET_TRACKERS[0], '2026-10-20T12:00:00.000Z');
    assert.equal(analyzeSingleCourseStatus(completed).status, 'completed');

    const reset = resetCourseToPending(completed);
    const statusAfter = analyzeSingleCourseStatus(reset);
    assert.equal(statusAfter.status, 'pending');
    assert.equal(statusAfter.completedLessonsCount, 0);
    assert.equal(statusAfter.minutesLogged, 0);
  });
});

describe('Unit Tests: YouTube Playlist Extraction, Series Title Normalization & Dynamic Player Mapping (TDD)', () => {
  test('parseYouTubeSourceUrl detects playlistId, videoId, startIndex, and timestampSeconds from watch+playlist and single video URLs', () => {
    const watchWithPlaylist = parseYouTubeSourceUrl(
      'https://www.youtube.com/watch?v=WQoB2z67hvY&list=PLDzeHZWIZsTryvtXdMr6rPh4IDexB5NIA&index=3&t=120s'
    );
    assert.equal(watchWithPlaylist.isYouTube, true);
    assert.equal(watchWithPlaylist.videoId, 'WQoB2z67hvY');
    assert.equal(watchWithPlaylist.playlistId, 'PLDzeHZWIZsTryvtXdMr6rPh4IDexB5NIA');
    assert.equal(watchWithPlaylist.startIndex, 3);
    assert.equal(watchWithPlaylist.timestampSeconds, 120);
    assert.equal(watchWithPlaylist.isPlaylistOrSeries, true);

    const singleVideoWithTimestamp = parseYouTubeSourceUrl(
      'https://youtu.be/_uQrJ0TkZlc?t=30m'
    );
    assert.equal(singleVideoWithTimestamp.isYouTube, true);
    assert.equal(singleVideoWithTimestamp.videoId, '_uQrJ0TkZlc');
    assert.equal(singleVideoWithTimestamp.playlistId, null);
    assert.equal(singleVideoWithTimestamp.timestampSeconds, 1800);
  });

  test('normalizeCourseSeriesTitle strips single-lecture prefixes so pasting Video 1 of a playlist sets the overall series title', () => {
    assert.equal(
      normalizeCourseSeriesTitle('Lecture 1: Introduction to C++ | Complete C++ Placement DSA Course'),
      'Complete C++ Placement DSA Course'
    );
    assert.equal(
      normalizeCourseSeriesTitle('Lesson 01: Docker & Containers Fundamentals'),
      'Docker & Containers Fundamentals'
    );
    assert.equal(
      normalizeCourseSeriesTitle('#1 Python Tutorial for Beginners — Variables & Memory'),
      'Python Tutorial for Beginners — Variables & Memory'
    );
  });

  test('parseYouTubePlaylistXmlFeed extracts playlist title, author, and sequential video items from YouTube XML feed', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>System Design &amp; Microservices Playlist</title>
  <author><name>ByteByteGo</name></author>
  <entry>
    <yt:videoId>vid_lec_1</yt:videoId>
    <title>Load Balancing &amp; Reverse Proxies</title>
  </entry>
  <entry>
    <yt:videoId>vid_lec_2</yt:videoId>
    <title>Consistent Hashing Deep Dive</title>
  </entry>
  <entry>
    <yt:videoId>vid_lec_3</yt:videoId>
    <title>Distributed Caching &amp; Redis Internals</title>
  </entry>
</feed>`;

    const parsed = parseYouTubePlaylistXmlFeed(sampleXml);
    assert.equal(parsed.playlistTitle, 'System Design & Microservices Playlist');
    assert.equal(parsed.playlistAuthor, 'ByteByteGo');
    assert.equal(parsed.videos.length, 3);
    assert.equal(parsed.videos[0].videoId, 'vid_lec_1');
    assert.equal(parsed.videos[1].videoId, 'vid_lec_2');
    assert.equal(parsed.videos[2].videoId, 'vid_lec_3');
  });

  test('resolveLessonEmbedUrl maps Lesson 1, Lesson 2, Lesson 3 to distinct embed URLs and NEVER defaults Lesson 2+ back to Lesson 1 video', () => {
    const playlistCourseUrl =
      'https://www.youtube.com/watch?v=FIRST_VID_ID&list=PL_TEST_PLAYLIST_999';

    // Case A: When individual videoIds were scraped for each lecture
    const embed1 = resolveLessonEmbedUrl(
      playlistCourseUrl,
      'https://www.youtube.com/watch?v=FIRST_VID_ID&list=PL_TEST_PLAYLIST_999&index=1',
      0
    );
    const embed2 = resolveLessonEmbedUrl(
      playlistCourseUrl,
      'https://www.youtube.com/watch?v=SECOND_VID_ID&list=PL_TEST_PLAYLIST_999&index=2',
      1
    );
    const embed3 = resolveLessonEmbedUrl(
      playlistCourseUrl,
      'https://www.youtube.com/watch?v=THIRD_VID_ID&list=PL_TEST_PLAYLIST_999&index=3',
      2
    );

    assert.ok(embed1.includes('/embed/FIRST_VID_ID'));
    assert.ok(embed2.includes('/embed/SECOND_VID_ID'));
    assert.ok(embed3.includes('/embed/THIRD_VID_ID'));
    assert.notEqual(embed1, embed2);
    assert.notEqual(embed2, embed3);

    // Case B: When only the playlist ID is known for Lesson 2 and Lesson 3, uses videoseries?list=...&index=N (never FIRST_VID_ID)
    const fallbackEmbed2 = resolveLessonEmbedUrl(
      playlistCourseUrl,
      'https://www.youtube.com/playlist?list=PL_TEST_PLAYLIST_999&index=2',
      1
    );
    const fallbackEmbed3 = resolveLessonEmbedUrl(
      playlistCourseUrl,
      'https://www.youtube.com/playlist?list=PL_TEST_PLAYLIST_999&index=3',
      2
    );
    assert.ok(
      !fallbackEmbed2.includes('FIRST_VID_ID'),
      `Lesson 2 embed (${fallbackEmbed2}) must not default back to FIRST_VID_ID`
    );
    assert.ok(fallbackEmbed2.includes('list=PL_TEST_PLAYLIST_999'));
    assert.ok(fallbackEmbed2.includes('index=1'));
    assert.ok(fallbackEmbed3.includes('index=2'));

    // Case C: Single long-form course video maps Lesson 1, Lesson 2, Lesson 3 to sequential chapter start timestamps
    const singleCourseUrl = 'https://www.youtube.com/watch?v=SINGLE_LONG_VID';
    const singleEmbed1 = resolveLessonEmbedUrl(singleCourseUrl, singleCourseUrl, 0);
    const singleEmbed2 = resolveLessonEmbedUrl(
      singleCourseUrl,
      'https://www.youtube.com/watch?v=SINGLE_LONG_VID&t=1800s',
      1
    );
    const singleEmbed3 = resolveLessonEmbedUrl(
      singleCourseUrl,
      'https://www.youtube.com/watch?v=SINGLE_LONG_VID&t=3600s',
      2
    );
    assert.ok(singleEmbed1.includes('/embed/SINGLE_LONG_VID'));
    assert.ok(singleEmbed2.includes('start=1800'));
    assert.ok(singleEmbed3.includes('start=3600'));
  });

  test('getActiveOrSelectedLesson dynamically switches to any clicked Lesson X in the roadmap or playlist queue', () => {
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y',
      rawTopic: 'DBMS',
      trackerId: 'tracker-select-lesson-test',
    });

    const allLessons = tracker.modules.flatMap(m => m.lessons);
    assert.ok(allLessons.length >= 6);

    // By default (no selectedLessonId), returns Lesson 1 (index 0)
    const defaultActive = getActiveOrSelectedLesson(tracker, null);
    assert.equal(defaultActive.lessonIndex, 0);
    assert.equal(defaultActive.lesson?.id, allLessons[0].id);

    // Clicking Lesson 4 (index 3) dynamically resolves Lesson 4 and its exact index
    const selectedFourth = getActiveOrSelectedLesson(tracker, allLessons[3].id);
    assert.equal(selectedFourth.lessonIndex, 3);
    assert.equal(selectedFourth.lesson?.id, allLessons[3].id);
    assert.equal(selectedFourth.lesson?.title, allLessons[3].title);
  });
});

describe('Unit Tests: LMS Phase — Smart Learning Progress, Continue Learning & Prev/Next Navigation (TDD)', () => {
  test('recordLastWatchedLesson remembers lastWatchedLessonId and updates lastAccessedAt timestamp', () => {
    const tracker = structuredClone(PRESET_TRACKERS[0]);
    const allLessons = tracker.modules.flatMap(m => m.lessons);
    const targetLesson = allLessons[3];

    const updated = recordLastWatchedLesson(tracker, targetLesson.id, '2026-11-04T10:00:00.000Z');
    assert.equal(updated.lastWatchedLessonId, targetLesson.id);
    assert.equal(updated.lastAccessedAt, '2026-11-04T10:00:00.000Z');
  });

  test('getPreviousAndNextLesson computes previous, next, and total lesson navigation accurately', () => {
    const tracker = structuredClone(PRESET_TRACKERS[0]);
    const allLessons = tracker.modules.flatMap(m => m.lessons);

    const firstNav = getPreviousAndNextLesson(tracker, allLessons[0].id);
    assert.equal(firstNav.currentIndex, 0);
    assert.equal(firstNav.previousLesson, null);
    assert.equal(firstNav.nextLesson?.id, allLessons[1].id);
    assert.equal(firstNav.totalCount, allLessons.length);

    const middleNav = getPreviousAndNextLesson(tracker, allLessons[2].id);
    assert.equal(middleNav.currentIndex, 2);
    assert.equal(middleNav.previousLesson?.id, allLessons[1].id);
    assert.equal(middleNav.nextLesson?.id, allLessons[3].id);

    const lastIdx = allLessons.length - 1;
    const lastNav = getPreviousAndNextLesson(tracker, allLessons[lastIdx].id);
    assert.equal(lastNav.currentIndex, lastIdx);
    assert.equal(lastNav.previousLesson?.id, allLessons[lastIdx - 1].id);
    assert.equal(lastNav.nextLesson, null);
  });

  test('getContinueLearningInfoForTracker and getContinueLearningState prioritize remembered lastWatchedLessonId across courses', () => {
    const trackerA = recordLastWatchedLesson(
      structuredClone(PRESET_TRACKERS[0]),
      PRESET_TRACKERS[0].modules[0].lessons[2].id,
      '2026-11-04T09:00:00.000Z'
    );
    const trackerB = recordLastWatchedLesson(
      structuredClone(PRESET_TRACKERS[1]),
      PRESET_TRACKERS[1].modules[0].lessons[1].id,
      '2026-11-04T11:30:00.000Z'
    );

    const infoA = getContinueLearningInfoForTracker(trackerA);
    assert.ok(infoA);
    assert.equal(infoA.lessonId, PRESET_TRACKERS[0].modules[0].lessons[2].id);
    assert.equal(infoA.lessonIndex, 2);

    // Global Continue Learning picks trackerB because it was accessed more recently
    const globalContinue = getContinueLearningState([trackerA, trackerB], trackerA.id);
    assert.ok(globalContinue.primaryContinue);
    assert.equal(globalContinue.primaryContinue.trackerId, trackerB.id);
    assert.equal(globalContinue.primaryContinue.lessonId, PRESET_TRACKERS[1].modules[0].lessons[1].id);
  });
});

describe('Unit Tests: LMS Phase — Personal Timestamped Video Notes, Bookmarks, Search & Export (TDD)', () => {
  test('formatSecondsToTimestamp and parseTimestampToSeconds convert MM:SS and HH:MM:SS reliably', () => {
    assert.equal(formatSecondsToTimestamp(0), '00:00');
    assert.equal(formatSecondsToTimestamp(125), '02:05');
    assert.equal(formatSecondsToTimestamp(3725), '01:02:05');

    assert.equal(parseTimestampToSeconds('02:05'), 125);
    assert.equal(parseTimestampToSeconds('01:02:05'), 3725);
    assert.equal(parseTimestampToSeconds('90'), 90);
  });

  test('addVideoNoteToTracker, updateVideoNoteInTracker, toggleBookmarkVideoNoteInTracker, and deleteVideoNoteFromTracker manage structured notes cleanly', () => {
    let tracker = structuredClone(PRESET_TRACKERS[0]);
    const lessonId = tracker.modules[0].lessons[2].id;

    // 1. Create a timestamped note with conceptTag and bookmark
    tracker = addVideoNoteToTracker(tracker, {
      lessonId,
      noteId: 'note-test-1',
      content: 'Unordered map lookup is O(1) average and O(N) worst case on hash collisions.',
      timestampInput: '04:20',
      conceptTag: 'Hash Collisions',
      isBookmarked: false,
      nowIso: '2026-11-04T12:00:00.000Z',
    });

    const lessonAfterAdd = tracker.modules[0].lessons.find(l => l.id === lessonId)!;
    const notesAfterAdd = getStructuredNotesForLesson(lessonAfterAdd, tracker.id);
    assert.equal(notesAfterAdd.length, 1);
    assert.equal(notesAfterAdd[0].id, 'note-test-1');
    assert.equal(notesAfterAdd[0].timestampSeconds, 260);
    assert.equal(notesAfterAdd[0].formattedTimestamp, '04:20');
    assert.equal(notesAfterAdd[0].conceptTag, 'Hash Collisions');
    assert.equal(notesAfterAdd[0].isBookmarked, false);

    // 2. Toggle bookmark on the note
    tracker = toggleBookmarkVideoNoteInTracker(tracker, lessonId, 'note-test-1');
    const notesAfterBookmark = getStructuredNotesForLesson(
      tracker.modules[0].lessons.find(l => l.id === lessonId)!,
      tracker.id
    );
    assert.equal(notesAfterBookmark[0].isBookmarked, true);

    // 3. Edit the note content and timestamp
    tracker = updateVideoNoteInTracker(tracker, {
      lessonId,
      noteId: 'note-test-1',
      content: 'Updated: Use custom splitmix64 hash in C++ to prevent anti-hash tests.',
      timestampInput: '06:15',
    });
    const notesAfterUpdate = getStructuredNotesForLesson(
      tracker.modules[0].lessons.find(l => l.id === lessonId)!,
      tracker.id
    );
    assert.equal(notesAfterUpdate[0].formattedTimestamp, '06:15');
    assert.equal(notesAfterUpdate[0].timestampSeconds, 375);
    assert.ok(notesAfterUpdate[0].content.includes('splitmix64'));

    // 4. Search & filter notes across the course
    const bookmarkedHits = searchAndFilterCourseNotes(tracker, {
      searchQuery: 'splitmix64',
      onlyBookmarked: true,
    });
    assert.equal(bookmarkedHits.length, 1);
    assert.equal(bookmarkedHits[0].id, 'note-test-1');

    // 5. Export notes to Markdown and JSON
    const mdExport = exportCourseNotesToMarkdown(tracker);
    assert.ok(mdExport.includes('# Study Notes:'));
    assert.ok(mdExport.includes('[06:15]'));
    assert.ok(mdExport.includes('splitmix64'));

    const jsonExport = exportCourseNotesToJson(tracker);
    const parsedJson = JSON.parse(jsonExport);
    assert.equal(parsedJson.courseId, tracker.id);
    assert.equal(parsedJson.totalNotes, notesAfterUpdate.length + 2);

    // 6. Delete note
    tracker = deleteVideoNoteFromTracker(tracker, lessonId, 'note-test-1');
    const notesAfterDelete = getStructuredNotesForLesson(
      tracker.modules[0].lessons.find(l => l.id === lessonId)!,
      tracker.id
    );
    assert.equal(notesAfterDelete.length, 0);
  });

  test('resolveLessonEmbedUrl supports seekTimestampSeconds when clicking a timestamped video note', () => {
    const embedUrl = resolveLessonEmbedUrl(
      'https://www.youtube.com/playlist?list=PL_TEST',
      'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PL_TEST&index=1',
      0,
      260
    );
    assert.ok(embedUrl.includes('/embed/kBdlM6hNDAE'));
    assert.ok(embedUrl.includes('start=260'));
  });
});

describe('Unit Tests: LMS Phase — Advanced Course Library Filtering, Sorting, Favorites & Bookmarks (TDD)', () => {
  test('categorizeCourseDifficulty and inferCourseTechnologies classify courses accurately', () => {
    const dsaTracker = PRESET_TRACKERS[0];
    assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(categorizeCourseDifficulty(dsaTracker.difficulty)));
    const dsaTech = inferCourseTechnologies(dsaTracker);
    assert.ok(dsaTech.includes('C++') || dsaTech.includes('Algorithms'));
  });

  test('toggleTrackerFavorite, toggleTrackerBookmark, and filterAndSortTrackers support search, difficulty, technology, favorites, and sorting', () => {
    const t1 = toggleTrackerFavorite(structuredClone(PRESET_TRACKERS[0])); // DSA, 2 lessons completed
    const t2 = toggleTrackerBookmark(structuredClone(PRESET_TRACKERS[1])); // Web Dev, 1 lesson completed
    const t3 = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PL_PYTHON',
      rawTopic: 'Python for Beginners',
      trackerId: 'tracker-lib-python',
    });

    const list = [t1, t2, t3];

    // Filter by onlyFavorites
    const favs = filterAndSortTrackers(list, { onlyFavorites: true });
    assert.equal(favs.length, 1);
    assert.equal(favs[0].id, t1.id);

    // Filter by onlyBookmarked
    const bookmarked = filterAndSortTrackers(list, { onlyBookmarked: true });
    assert.equal(bookmarked.length, 1);
    assert.equal(bookmarked[0].id, t2.id);

    // Filter by search query
    const pythonHits = filterAndSortTrackers(list, { searchQuery: 'Python' });
    assert.equal(pythonHits.length, 1);
    assert.equal(pythonHits[0].id, 'tracker-lib-python');

    // Sort by completion descending (t2 is 1/4 = 25%, t1 is 2/9 = 22%, t3 is 0%)
    const sortedByCompletion = filterAndSortTrackers(list, { sortBy: 'completion' });
    assert.equal(sortedByCompletion[0].id, t2.id);
    assert.equal(sortedByCompletion[1].id, t1.id);
    assert.equal(sortedByCompletion[2].id, t3.id);

    // Sort by title A-Z
    const sortedByTitle = filterAndSortTrackers(list, { sortBy: 'title' });
    assert.ok(sortedByTitle[0].title.localeCompare(sortedByTitle[1].title) <= 0);
  });
});

describe('Unit Tests: LMS Phase — Student Dashboard Summary, Weekly Activity & User Data Isolation (TDD)', () => {
  test('computeStudentDashboardSummary and computeWeeklyLearningActivity calculate accurate totals, streak, and 7-day history', () => {
    const trackers = structuredClone(PRESET_TRACKERS);
    const summary = computeStudentDashboardSummary(
      trackers,
      [
        { date: '2026-11-04', minutesStudied: 60, lessonsCompletedCount: 1 },
        { date: '2026-11-03', minutesStudied: 45, lessonsCompletedCount: 1 },
      ],
      5,
      60,
      trackers[0].id,
      '2026-11-04'
    );

    assert.equal(summary.totalEnrolledCourses, trackers.length);
    assert.ok(summary.totalCompletedLessons >= 3);
    assert.ok(summary.totalAvailableLessons >= 15);
    assert.ok(summary.overallProgressPercent > 0 && summary.overallProgressPercent <= 100);
    assert.equal(summary.currentStreakDays, 5);
    assert.equal(summary.weeklyActivity.length, 7);
    assert.ok(summary.continueLearning);
    assert.ok(summary.recentlyAccessedCourses.length > 0);
  });

  test('getUserScopedStorageKey isolates localStorage keys per userId and deleteTrackerFromList removes target course cleanly', () => {
    assert.equal(getUserScopedStorageKey(undefined, 'devtrack_trackers_v2'), 'devtrack_trackers_v2');
    assert.equal(
      getUserScopedStorageKey('user_alex_99', 'devtrack_trackers_v2'),
      'devtrack_trackers_v2__user_user_alex_99'
    );

    const list = structuredClone(PRESET_TRACKERS);
    const remaining = deleteTrackerFromList(list, list[0].id);
    assert.equal(remaining.length, list.length - 1);
    assert.ok(!remaining.some(t => t.id === list[0].id));
  });
});

describe('Unit Tests: Student Onboarding, Personalized Profile & Course-Based Personal Notes System (FEATURE 1-7)', () => {
  test('1 & 2. New student registration and skipping optional onboarding questions compute accurate profile completion percentage', () => {
    const newStudent = registerNewStudentProfile({
      name: 'Priya Nair',
      email: 'priya.nair@college.edu',
      country: 'India',
      preferredLanguage: 'English',
      role: 'College / University Student',
    });

    assert.ok((newStudent.userId || '').startsWith('student-'));
    assert.equal(newStudent.name, 'Priya Nair');
    assert.equal(newStudent.email, 'priya.nair@college.edu');
    assert.equal(newStudent.onboardingCompleted, false);

    // Simulate skipping optional onboarding fields (collegeOrUniversity and academicYearOrSemester left blank)
    const partiallyOnboarded = {
      ...newStudent,
      collegeOrUniversity: '',
      academicYearOrSemester: '',
      personalLearningGoals: '',
      onboardingCompleted: true,
    };

    const reportPartial = calculateProfileCompletionReport(partiallyOnboarded);
    assert.ok(reportPartial.percentage < 100);
    assert.ok(reportPartial.missingFields.includes('College or University (Optional)'));
    assert.ok(reportPartial.missingFields.includes('Academic Year or Semester (Optional)'));
    assert.ok(reportPartial.missingFields.includes('Personal Learning Goals'));

    // Completing all 11 onboarding fields reaches 100% completion
    const fullyCompleted = {
      ...partiallyOnboarded,
      educationLevel: 'Undergraduate Degree',
      currentDegree: 'B.Tech CSE',
      collegeOrUniversity: 'IIT Bombay',
      academicYearOrSemester: '3rd Year / Semester 5',
      careerAspiration: 'Software Engineer',
      learningInterests: ['DSA', 'DBMS & SQL'],
      skillLevels: { DSA: 'Intermediate' as const, 'DBMS & SQL': 'Beginner' as const },
      personalLearningGoals: ['Master DSA, DBMS, and System Design for placement interviews'],
    };
    const reportFull = calculateProfileCompletionReport(fullyCompleted);
    assert.equal(reportFull.percentage, 100);
    assert.equal(reportFull.missingFields.length, 0);
  });

  test('3. Saving and editing student profiles personalizes course recommendations and learning roadmaps', () => {
    const profile = registerNewStudentProfile({
      name: 'Rohan Gupta',
      email: 'rohan@devtrack.io',
      role: 'College / University Student',
    });

    const editedProfile = {
      ...profile,
      careerAspiration: 'Backend & Database Systems Engineer',
      learningInterests: ['SQL & Database Systems (DBMS)', 'System Design & Scalability'],
      skillLevels: {
        'SQL & Database Systems (DBMS)': 'Intermediate' as const,
        'System Design & Scalability': 'Beginner' as const,
      },
      dailyMinutesTarget: 90,
      onboardingCompleted: true,
    };

    const recommendations = computePersonalizedCourseRecommendations(
      editedProfile,
      PRESET_TRACKERS
    );
    assert.ok(recommendations.length >= 2);
    assert.ok(
      recommendations.some(
        r => r.category === 'DBMS' || r.title.toLowerCase().includes('dbms')
      ),
      'Should recommend DBMS track matching learningInterests'
    );
    assert.ok(
      recommendations[0].matchScore >= recommendations[recommendations.length - 1].matchScore,
      'Recommendations should be sorted by matchScore descending'
    );
  });

  test('4, 5 & 6. Creating notes for different courses and different lectures, auto-save upsert without duplication, and reopening a lecture to retrieve existing notes', () => {
    let courseA = structuredClone(PRESET_TRACKERS[0]); // DSA
    let courseB = structuredClone(PRESET_TRACKERS[1]); // Web Dev

    const courseALesson1 = courseA.modules[0].lessons[0].id;
    const courseALesson2 = courseA.modules[0].lessons[1].id;
    const courseBLesson1 = courseB.modules[0].lessons[0].id;

    // Auto-save simulation on Course A, Lecture 1: typing triggers multiple saves with the SAME noteId
    courseA = addVideoNoteToTracker(courseA, {
      noteId: 'autosave-note-a1',
      userId: 'user-student-1',
      lessonId: courseALesson1,
      heading: 'Two Pointers Draft',
      content: 'Initial partial typing...',
      timestampInput: '03:10',
      isBookmarked: false,
      conceptTag: 'Two Pointers',
      tags: ['Important'],
      nowIso: '2026-11-04T10:00:00.000Z',
    });

    // Debounced auto-save fires again on the same noteId -> must update in-place without duplicating
    courseA = addVideoNoteToTracker(courseA, {
      noteId: 'autosave-note-a1',
      userId: 'user-student-1',
      lessonId: courseALesson1,
      heading: 'Two Pointers Technique & Invariant',
      content: '• Move left pointer when sum < target\n• Move right pointer when sum > target',
      codeSnippet: 'while (l < r) { if (a[l] + a[r] === target) return [l, r]; }',
      codeLanguage: 'typescript',
      timestampInput: '03:10',
      isBookmarked: true,
      conceptTag: 'Two Pointers',
      tags: ['Important', 'Code', 'Interview'],
      nowIso: '2026-11-04T10:01:00.000Z',
    });

    // Create a note on Course A, Lecture 2
    courseA = addVideoNoteToTracker(courseA, {
      noteId: 'note-a2',
      userId: 'user-student-1',
      lessonId: courseALesson2,
      heading: 'Recursion Stack Depth',
      content: 'Base case prevents stack overflow; space complexity is O(depth).',
      timestampInput: '07:45',
      isBookmarked: false,
      conceptTag: 'Recursion',
      tags: ['Revision', 'Exam'],
      nowIso: '2026-11-04T10:05:00.000Z',
    });

    // Create a note on Course B, Lecture 1
    courseB = addVideoNoteToTracker(courseB, {
      noteId: 'note-b1',
      userId: 'user-student-1',
      lessonId: courseBLesson1,
      heading: 'React Fiber Reconciliation',
      content: 'Keys must be stable across renders to preserve component state.',
      timestampInput: '11:20',
      isBookmarked: true,
      conceptTag: 'React Reconciliation',
      tags: ['Important', 'Interview'],
      nowIso: '2026-11-04T10:10:00.000Z',
    });

    // Reopen Course A, Lecture 1 and retrieve its existing notes
    const reopenedLesson1Notes = searchAndFilterCourseNotes(courseA, {
      lessonId: courseALesson1,
    });
    const matchingAutoSaved = reopenedLesson1Notes.filter(n => n.id === 'autosave-note-a1');
    assert.equal(
      matchingAutoSaved.length,
      1,
      'Auto-saved note must not be duplicated when saved multiple times'
    );
    assert.equal(matchingAutoSaved[0].heading, 'Two Pointers Technique & Invariant');
    assert.ok(matchingAutoSaved[0].codeSnippet?.includes('while (l < r)'));
    assert.deepEqual(matchingAutoSaved[0].tags, ['Important', 'Code', 'Interview']);

    // Reopen Course A, Lecture 2 and confirm Lecture 1 notes do not leak into Lecture 2
    const reopenedLesson2Notes = searchAndFilterCourseNotes(courseA, {
      lessonId: courseALesson2,
    });
    assert.ok(reopenedLesson2Notes.some(n => n.id === 'note-a2'));
    assert.ok(!reopenedLesson2Notes.some(n => n.id === 'autosave-note-a1'));
  });

  test('7, 8 & 9. Viewing notes from Dashboard and My Notes hierarchy (Course -> Lecture -> Notes), editing/deleting across courses, and enforcing user-specific RLS privacy', () => {
    let trackers = structuredClone(PRESET_TRACKERS.slice(0, 2));
    const c1Lesson = trackers[0].modules[0].lessons[0].id;
    const c2Lesson = trackers[1].modules[0].lessons[0].id;

    // User A creates a note in Course 1
    trackers[0] = addVideoNoteToTracker(trackers[0], {
      noteId: 'rls-note-user-a',
      userId: 'user_alice',
      lessonId: c1Lesson,
      heading: 'Alice Private DSA Note',
      content: 'Binary search mid calculation: l + ((r - l) >> 1)',
      timestampInput: '04:00',
      isBookmarked: true,
      conceptTag: 'Binary Search',
      tags: ['Formula'],
      nowIso: new Date(Date.now() + 60_000).toISOString(),
    });

    // User B creates a note in Course 2
    trackers[1] = addVideoNoteToTracker(trackers[1], {
      noteId: 'rls-note-user-b',
      userId: 'user_bob',
      lessonId: c2Lesson,
      heading: 'Bob Private Web Note',
      content: 'Use semantic HTML elements for screen readers.',
      timestampInput: '02:30',
      isBookmarked: false,
      conceptTag: 'Accessibility',
      tags: ['Important'],
      nowIso: new Date(Date.now() + 120_000).toISOString(),
    });

    // RLS check: User Alice only sees her own notes (plus legacy preset notes without a foreign userId)
    const aliceNotes = getAllNotesAcrossTrackers(trackers, { userId: 'user_alice' });
    assert.ok(aliceNotes.some(n => n.id === 'rls-note-user-a'));
    assert.ok(
      !aliceNotes.some(n => n.id === 'rls-note-user-b'),
      'User Alice must NEVER see User Bob private note'
    );

    // Hierarchy check: Course -> Lecture -> Personal Notes
    const hierarchy = groupNotesByCourseAndLecture(trackers, aliceNotes);
    assert.ok(hierarchy.length >= 1);
    const course1Group = hierarchy.find(g => g.courseId === trackers[0].id);
    assert.ok(course1Group);
    assert.ok(course1Group.lectures.some(l => l.lessonId === c1Lesson));

    // Dashboard Recent Notes widget check
    const recentForAlice = getRecentNotesForDashboard(trackers, 5, 'user_alice');
    assert.equal(recentForAlice[0].id, 'rls-note-user-a');
    assert.equal(recentForAlice[0].trackerTitle, trackers[0].title);

    // Edit note from Centralized My Notes Library -> updates the single source of truth
    trackers = updateNoteAcrossTrackers(trackers, {
      trackerId: trackers[0].id,
      lessonId: c1Lesson,
      noteId: 'rls-note-user-a',
      heading: 'Alice Updated Heading',
      content: 'Updated content from My Notes Library',
      tags: ['Formula', 'Revision'],
    });

    const afterUpdateInLecture = searchAndFilterCourseNotes(trackers[0], {
      lessonId: c1Lesson,
    }).find(n => n.id === 'rls-note-user-a');
    assert.ok(afterUpdateInLecture);
    assert.equal(afterUpdateInLecture.heading, 'Alice Updated Heading');
    assert.equal(afterUpdateInLecture.content, 'Updated content from My Notes Library');

    const mdLibrary = exportMultiCourseNotesToMarkdown(trackers, aliceNotes);
    assert.ok(mdLibrary.includes('# DevTrack Centralized Personal Notes Library'));

    // Delete note across trackers
    trackers = deleteNoteAcrossTrackers(trackers, trackers[0].id, c1Lesson, 'rls-note-user-a');
    const afterDelete = getAllNotesAcrossTrackers(trackers, { userId: 'user_alice' });
    assert.ok(!afterDelete.some(n => n.id === 'rls-note-user-a'));
  });

  test('10. Exporting My Notes Library into a formatted PDF file (%PDF-1.4) for offline revision', () => {
    let trackers = structuredClone(PRESET_TRACKERS);
    const dsaLessonId = trackers[0].modules[0].lessons[0].id;
    const webLessonId = trackers[1].modules[0].lessons[0].id;

    trackers[0] = addVideoNoteToTracker(trackers[0], {
      noteId: 'pdf-note-dsa-1',
      userId: 'user_pdf_tester',
      lessonId: dsaLessonId,
      heading: 'Binary Search Midpoint Invariant',
      content: 'Always compute mid = low + (high - low) / 2 to avoid 32-bit signed integer overflow.',
      codeSnippet: 'int mid = low + (high - low) / 2;',
      codeLanguage: 'cpp',
      timestampInput: '05:45',
      tags: ['Important', 'Formula', 'Exam'],
      isBookmarked: true,
      conceptTag: 'Binary Search',
    });

    trackers[1] = addVideoNoteToTracker(trackers[1], {
      noteId: 'pdf-note-web-1',
      userId: 'user_pdf_tester',
      lessonId: webLessonId,
      heading: 'Express Middleware Execution Order',
      content: 'Error-handling middleware takes 4 arguments (err, req, res, next) and mounts last.',
      codeSnippet: 'app.use((err, req, res, next) => res.status(500).json({ error: err.message }));',
      codeLanguage: 'typescript',
      timestampInput: '11:20',
      tags: ['Revision', 'Code'],
      isBookmarked: false,
      conceptTag: 'Middleware',
    });

    const allNotes = getAllNotesAcrossTrackers(trackers, { userId: 'user_pdf_tester' });
    assert.ok(allNotes.length >= 2);

    const pdfDoc = buildFormattedRevisionPdfDocument(trackers, allNotes, {
      documentTitle: 'Semester Exam & SDE Revision Booklet',
      learnerName: 'Aarav Sharma',
      learnerRole: 'B.Tech CSE (3rd Year)',
      includeCodeSnippets: true,
      includeTableOfContents: true,
      includeRevisionCheckboxes: true,
      includeTimestampsAndTags: true,
      filterSummary: 'All Courses',
      exportedAtIso: '2026-11-04T10:30:00.000Z',
    });

    // Verify metadata and filename
    assert.equal(pdfDoc.title, 'Semester Exam & SDE Revision Booklet');
    assert.equal(pdfDoc.filename, 'semester-exam-sde-revision-booklet-2026-11-04.pdf');
    assert.ok(pdfDoc.totalCourses >= 2);
    assert.ok(pdfDoc.totalLectures >= 2);
    assert.equal(pdfDoc.totalNotes, allNotes.length);
    assert.ok(pdfDoc.tableOfContents.length >= 2);
    assert.ok(pdfDoc.pages.length >= 1);

    // Verify valid %PDF-1.4 header, fonts, content stream text, xref table, and %%EOF trailer
    assert.ok(pdfDoc.pdfString.startsWith('%PDF-1.4\n'), 'PDF must start with %PDF-1.4 header');
    assert.ok(pdfDoc.pdfString.includes('/BaseFont /Helvetica'), 'PDF must include Helvetica font');
    assert.ok(pdfDoc.pdfString.includes('/BaseFont /Helvetica-Bold'), 'PDF must include Helvetica-Bold font');
    assert.ok(pdfDoc.pdfString.includes('/BaseFont /Courier'), 'PDF must include Courier font for code snippets');
    assert.ok(
      pdfDoc.pdfString.includes('Semester Exam & SDE Revision Booklet'),
      'PDF content stream must include document title'
    );
    assert.ok(
      pdfDoc.pdfString.includes('[ ] Binary Search Midpoint Invariant'),
      'PDF content stream must include note heading with self-test revision checkbox'
    );
    assert.ok(
      pdfDoc.pdfString.includes('int mid = low + \\(high - low\\) / 2;'),
      'PDF content stream must escape parentheses and include code snippet'
    );
    assert.ok(pdfDoc.pdfString.includes('\nxref\n'), 'PDF must include cross-reference table');
    assert.ok(pdfDoc.pdfString.trimEnd().endsWith('%%EOF'), 'PDF must end with %%EOF marker');
    assert.ok(pdfDoc.pdfBytes instanceof Uint8Array);
    assert.ok(pdfDoc.pdfBytes.byteLength > 1000);

    // Verify toggling options (e.g., excluding code snippets and checkboxes)
    const compactDoc = buildFormattedRevisionPdfDocument(trackers, allNotes, {
      documentTitle: 'Compact Notes Sheet',
      includeCodeSnippets: false,
      includeRevisionCheckboxes: false,
      includeTableOfContents: false,
    });
    assert.ok(!compactDoc.pdfString.includes('--- Code Snippet'));
    assert.ok(!compactDoc.pdfString.includes('[ ] Binary Search Midpoint Invariant'));
    assert.ok(compactDoc.pdfString.includes('Binary Search Midpoint Invariant'));

    // Verify text wrapping and ASCII sanitization helpers
    assert.equal(sanitizePdfAsciiText('Course → Lecture ★ Note'), 'Course -> Lecture [*] Note');
    const wrapped = wrapPdfTextLines(
      'This is a long sentence that should cleanly wrap across multiple lines when exported to a PDF revision sheet.',
      35
    );
    assert.ok(wrapped.length >= 3);
    assert.ok(wrapped.every(line => line.length <= 35));
  });

  test('11. Focus & Pomodoro Concentration System, In-Course Lesson Search, Next-Step Guidance & Real Activity Achievements', () => {
    // 1. Focus & Pomodoro Settings + Phase Durations
    const defaultSettings = createDefaultFocusTimerSettings(90);
    assert.equal(defaultSettings.studyMinutes, 25);
    assert.equal(defaultSettings.shortBreakMinutes, 5);
    assert.equal(defaultSettings.longBreakMinutes, 15);
    assert.equal(defaultSettings.dailyFocusGoalMinutes, 90);

    assert.equal(resolveFocusPhaseDurationSeconds(defaultSettings, 'study'), 25 * 60);
    assert.equal(resolveFocusPhaseDurationSeconds(defaultSettings, 'short_break'), 5 * 60);
    assert.equal(resolveFocusPhaseDurationSeconds(defaultSettings, 'long_break'), 15 * 60);

    // 2. Recording Focus Sessions & Analytics
    let sessions = recordCompletedFocusSession([], {
      courseId: 'tracker-dsa',
      courseTitle: 'DSA Masterclass',
      lessonId: 'lesson-1',
      lessonTitle: 'Lec 1: Arrays',
      phase: 'study',
      durationMinutes: 25,
      completedAt: '2026-11-05T09:00:00.000Z',
      summaryNote: 'Completed Two Pointers Pomodoro block',
    });
    sessions = recordCompletedFocusSession(sessions, {
      courseId: 'tracker-dsa',
      courseTitle: 'DSA Masterclass',
      lessonId: 'lesson-2',
      lessonTitle: 'Lec 2: Pointers',
      phase: 'study',
      durationMinutes: 30,
      completedAt: '2026-11-05T10:00:00.000Z',
    });

    const analytics = computeFocusSessionAnalytics(sessions, 50, '2026-11-05');
    assert.equal(analytics.todayFocusMinutes, 55);
    assert.equal(analytics.studySessionsCount, 2);
    assert.equal(analytics.dailyGoalPercent, 100);
    assert.equal(analytics.recentSessions.length, 2);

    // 3. In-Course Lesson Search & Filter
    const dsaLessons = structuredClone(PRESET_TRACKERS[0].modules.flatMap(m => m.lessons));
    const allLessons = filterCourseLessons(dsaLessons, '', 'all');
    assert.equal(allLessons.length, dsaLessons.length);

    const completedOnly = filterCourseLessons(dsaLessons, '', 'completed');
    assert.ok(completedOnly.every(item => item.lesson.completed));

    const pendingOnly = filterCourseLessons(dsaLessons, '', 'pending');
    assert.ok(pendingOnly.every(item => !item.lesson.completed));

    const searchByKeyword = filterCourseLessons(dsaLessons, 'Kadane', 'all');
    assert.equal(searchByKeyword.length, 1);
    assert.ok(searchByKeyword[0].lesson.title.includes('Kadane'));

    // 4. Learner Next-Step Recommendation (Journey Step 6)
    const emptyStep = computeLearnerNextStepRecommendation(null, [], 60);
    assert.equal(emptyStep.actionType, 'add_course');

    const activeStep = computeLearnerNextStepRecommendation(
      PRESET_TRACKERS[0],
      [{ date: '2026-11-05', minutesStudied: 20, lessonsCompletedCount: 1 }],
      60,
      '2026-11-05'
    );
    assert.equal(activeStep.actionType, 'resume_lesson');
    assert.equal(activeStep.trackerId, PRESET_TRACKERS[0].id);
    assert.ok(activeStep.headline.includes('Next Step: Lecture'));

    // 5. Real Activity Achievements (Journey Step 5)
    const achievements = computeLearnerAchievements(
      PRESET_TRACKERS,
      [{ date: '2026-11-05', minutesStudied: 150, lessonsCompletedCount: 2 }],
      4,
      sessions
    );
    assert.equal(achievements.length, 5);
    assert.equal(achievements.find(a => a.id === 'ach-first-lecture')?.unlocked, true);
    assert.equal(achievements.find(a => a.id === 'ach-streak-builder')?.unlocked, true);
    assert.equal(achievements.find(a => a.id === 'ach-deep-focus')?.unlocked, true);
  });

  test('12. My Profile Custom Photo Upload, Initials Avatar Generator, Non-Blocking URL Resolution & Conditional Registration Visibility', () => {
    // 1. New student who has not completed profile yet -> isLearnerProfileCreated is false
    const incompleteProfile = registerNewStudentProfile({
      name: 'Prateek Singh',
      email: 'prateek@devtrack.io',
      role: 'Software Engineer',
    });
    assert.equal(isLearnerProfileCreated(incompleteProfile), false);

    // 2. Once learner creates/saves their profile once -> isLearnerProfileCreated is true (hide Register New Student)
    const completedProfile = {
      ...incompleteProfile,
      onboardingCompleted: true,
    };
    assert.equal(isLearnerProfileCreated(completedProfile), true);

    // 3. Initials Avatar SVG generator
    const initialsDataUrl = generateInitialsAvatarDataUrl('Prateek Singh');
    assert.ok(initialsDataUrl.startsWith('data:image/svg+xml;utf8,'));
    assert.ok(decodeURIComponent(initialsDataUrl).includes('>PS<'));

    // 4. sanitizeProfileAvatarUrl supports uploaded data:image/... photos, relative preset paths (/src/assets/...), and external links
    assert.equal(
      sanitizeProfileAvatarUrl('data:image/jpeg;base64,abc123', '', 'Prateek Singh'),
      'data:image/jpeg;base64,abc123'
    );
    assert.equal(
      sanitizeProfileAvatarUrl('/src/assets/images/avatar_student_alex_1793187697984.jpg', '', 'Prateek Singh'),
      '/src/assets/images/avatar_student_alex_1793187697984.jpg'
    );
    assert.equal(
      sanitizeProfileAvatarUrl('/src/assets/images/avatar_student_alex_1793187697984.jpg', 'https://example.com/my-pic.png', 'Prateek Singh'),
      'https://example.com/my-pic.png'
    );
  });

  test('13. 2-Column Side-by-Side Video Learning Workspace: Playlist Tab Label & Inline Professor Mentor Quick Prompts', () => {
    assert.equal(formatPlaylistTabLabel(0, 9), 'Playlist (1/9)');
    assert.equal(formatPlaylistTabLabel(2, 8), 'Playlist (3/8)');

    const explainPrompt = buildInlineProfessorQuickPrompt(
      'explain',
      'Lec 3: Hashing & Frequency Counting Maps',
      ['Direct Address Table', 'Collision Handling']
    );
    assert.ok(explainPrompt.includes('Explain "Lec 3: Hashing & Frequency Counting Maps"'));
    assert.ok(explainPrompt.includes('Direct Address Table'));

    const codePrompt = buildInlineProfessorQuickPrompt(
      'code',
      'Lec 3: Hashing & Frequency Counting Maps',
      ['Direct Address Table']
    );
    assert.ok(codePrompt.includes('Give a clean code example'));

    const quizPrompt = buildInlineProfessorQuickPrompt(
      'quiz',
      'Lec 3: Hashing & Frequency Counting Maps',
      ['Direct Address Table']
    );
    assert.ok(quizPrompt.includes('Quiz me on'));
  });

  test('14. 1-on-1 Concept & Technical Mentor: Professor Mode (Beginner) vs Technical Mode (Deep Dive + Code) quick prompts, system instructions, and fallback behavior', () => {
    assert.equal(normalizeConceptMentorMode('simple'), 'simple');
    assert.equal(normalizeConceptMentorMode('technical'), 'technical');
    assert.equal(normalizeConceptMentorMode('interview'), 'technical');

    const lectureTitle = 'Lec 3: Hashing & Frequency Counting Maps';
    const keyConcepts = ['Direct Address Table', 'unordered_map vs map'];

    // Professor Mode (Beginner) 1-click quick prompts
    const professorChips = buildConceptMentorQuickPrompts('simple', lectureTitle, keyConcepts);
    assert.equal(professorChips.length, 4);
    assert.equal(
      professorChips[0],
      `Teach me ${lectureTitle} like I am a beginner with a real-world analogy`
    );
    assert.equal(
      professorChips[1],
      `Walk me through a tiny step-by-step example for ${lectureTitle}`
    );
    assert.equal(
      professorChips[2],
      `Show simple beginner code for ${keyConcepts[0]} and explain each line`
    );

    // Technical Mode (Deep Dive + Code) 1-click quick prompts (exact 4 prompts)
    const technicalChips = buildConceptMentorQuickPrompts('technical', lectureTitle, keyConcepts);
    assert.deepEqual(technicalChips, [
      `Explain the exact technical definition and internal working of ${lectureTitle}`,
      `Show syntax rules, edge cases, and memory behavior for ${lectureTitle}`,
      `Provide a clean code implementation with technical comments and complexity analysis`,
      `What are the common technical pitfalls and best practices in ${lectureTitle}?`,
    ]);

    // System instructions differentiate Professor Mode vs Technical Mode
    const profPrompt = buildConceptMentorSystemPrompt({
      mode: 'simple',
      topic: 'Python Programming',
      currentLesson: 'Strings & Immutability',
      question: 'How do Strings work in Python?',
    });
    assert.ok(profPrompt.includes('PROFESSOR MODE (Beginner)'));
    assert.ok(profPrompt.includes('simple everyday language, zero heavy jargon'));

    const techPrompt = buildConceptMentorSystemPrompt({
      mode: 'technical',
      topic: 'Python Programming',
      currentLesson: 'Strings & Immutability',
      question: 'How are immutable strings stored in memory?',
    });
    assert.ok(techPrompt.includes('TECHNICAL MODE (Deep Dive + Code)'));
    assert.ok(
      techPrompt.includes(
        'strict computer science and software engineering perspective. Provide precise technical definitions, under-the-hood memory and execution behavior, syntax rules, time & space complexity'
      )
    );

    // Fallback responses differentiate Professor Mode vs Technical Mode
    const fallbackSimple = buildSmartConceptFallback(
      'Python Programming',
      undefined,
      'How do Strings work in Python?',
      'Computer Science Core',
      'simple'
    );
    assert.equal(fallbackSimple.technicalDeepDive, undefined);
    assert.ok(fallbackSimple.directAnswer.includes('sealed glass display case'));

    const fallbackTechnical = buildSmartConceptFallback(
      'Python Programming',
      undefined,
      'How are immutable strings stored in memory?',
      'Computer Science Core',
      'technical'
    );
    assert.ok(fallbackTechnical.technicalDeepDive?.exactDefinition);
    assert.ok(fallbackTechnical.technicalDeepDive?.memoryAndExecutionBehavior);
    assert.ok(fallbackTechnical.technicalDeepDive?.syntaxAndEdgeCases);
  });

  test('15. Mettleway. Daily Class Schedule, Google Calendar RRULE:FREQ=DAILY Sync & Attendance Verification (+50 XP)', () => {
    assert.equal(METTLEWAY_BRAND_NAME, 'Mettleway.');
    assert.equal(METTLEWAY_SCHEDULE_STORAGE_KEY, 'mettleway_schedule');
    assert.equal(DEFAULT_METTLEWAY_CLASS_TIME_24, '16:00');
    assert.equal(DEFAULT_METTLEWAY_CLASS_DURATION_MINS, 60);

    // 1. Time formatting & Dashboard status badge
    assert.equal(formatTime24To12Hour('16:00'), '04:00 PM');
    assert.equal(formatTime24To12Hour('09:30'), '09:30 AM');
    assert.equal(
      formatMettlewayDailyClassBadge('16:00'),
      '⚡ Daily Class: 04:00 PM | Attendance Streak'
    );

    // 2. Attendance verification within 30 minutes of scheduled class time
    const refAt415PM = new Date(2026, 4, 15, 16, 15, 0);
    const refAt340PM = new Date(2026, 4, 15, 15, 40, 0);
    const refAt600PM = new Date(2026, 4, 15, 18, 0, 0);
    assert.equal(isWithinScheduledClassWindow('16:00', refAt415PM, 30), true);
    assert.equal(isWithinScheduledClassWindow('16:00', refAt340PM, 30), true);
    assert.equal(isWithinScheduledClassWindow('16:00', refAt600PM, 30), false);

    // 3. Recurring Google Calendar template link generation
    const calendarUrl = buildMettlewayDailyClassCalendarUrl({
      courseName: "Striver's A2Z DSA Master Path",
      scheduledTime24: '16:00',
      durationMinutes: 60,
      joinUrl: 'http://localhost:3000/',
      referenceDate: new Date(2026, 4, 15, 10, 0, 0),
    });

    const parsedCalUrl = new URL(calendarUrl);
    assert.equal(parsedCalUrl.origin, 'https://calendar.google.com');
    assert.equal(parsedCalUrl.pathname, '/calendar/render');
    assert.equal(parsedCalUrl.searchParams.get('action'), 'TEMPLATE');
    assert.equal(
      parsedCalUrl.searchParams.get('text'),
      "🔴 Mettleway. Live Class: Striver's A2Z DSA Master Path"
    );
    assert.equal(
      parsedCalUrl.searchParams.get('details'),
      'Your daily class is starting now! Keep your streak alive on Mettleway.\n\nJoin Session: http://localhost:3000/'
    );
    assert.equal(parsedCalUrl.searchParams.get('recur'), 'RRULE:FREQ=DAILY');
    assert.match(parsedCalUrl.searchParams.get('dates') || '', /T160000\/.*T170000/);

    // 4. Smooth in-app alarm lock & automatic return to platform workspace ('today')
    const confirmed = confirmAndLockMettlewayAlarm(
      {
        scheduledTime24: '17:30',
        durationMinutes: 45,
        courseName: "Striver's A2Z DSA Master Path",
        streakDays: 5,
      },
      new Date(2026, 4, 15, 17, 15, 0)
    );
    assert.equal(confirmed.shouldCloseModal, true);
    assert.equal(confirmed.returnTab, 'today');
    assert.equal(confirmed.schedule.formattedTime12, '05:30 PM');
    assert.equal(confirmed.schedule.durationMinutes, 45);
    assert.equal(confirmed.schedule.attendanceVerifiedToday, true);
    assert.ok(confirmed.toastMessage.includes('05:30 PM'));
    assert.ok(confirmed.toastMessage.includes('Mettleway.'));

    // 5. About Mettleway. feedback email & mailto helper
    assert.equal(METTLEWAY_FEEDBACK_EMAIL, 'YOUR_EMAIL@gmail.com');
    assert.equal(
      buildMettlewayFeedbackMailtoUrl(),
      'mailto:YOUR_EMAIL@gmail.com?subject=Mettleway.%20Learner%20Suggestion'
    );
  });

  test('16. Direct YouTube Course Search (YouTube Data API v3, Curated Fallback, URL Sanitization & Dual-Mode Detection)', async () => {
    // 1. Dual-mode detection accurately distinguishes URLs from topic queries
    assert.equal(
      detectSearchOrUrlMode('https://www.youtube.com/playlist?list=PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_BHz'),
      'url'
    );
    assert.equal(detectSearchOrUrlMode('https://youtu.be/kBdlM6hNDAE'), 'url');
    assert.equal(detectSearchOrUrlMode('Python Full Course'), 'search');
    assert.equal(detectSearchOrUrlMode('React JS'), 'search');
    assert.equal(detectSearchOrUrlMode('DSA'), 'search');

    // 2. Live YouTube Data API v3 search builds the exact expected endpoint and sanitizes unsafe URLs/entities
    let capturedEndpoint = '';
    const mockApiFetch = async (url: string) => {
      capturedEndpoint = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: { playlistId: 'PLvalidReactCourse001' },
              snippet: {
                title: 'React JS &amp; Hooks Full Course',
                channelTitle: 'Code &amp; Architecture',
                description: 'Master React &quot;Hooks&quot; &amp; Context API',
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/RGKi6LSPDLU/hqdefault.jpg' },
                },
              },
            },
            {
              id: { playlistId: 'PLunsafeThumbPlaylist2' },
              snippet: {
                title: 'Unsafe Thumb Test',
                channelTitle: 'Tester',
                thumbnails: {
                  high: { url: 'javascript:alert(1)' },
                },
              },
            },
            {
              id: { playlistId: 'bad' }, // too short / invalid -> skipped
              snippet: { title: 'Should be skipped' },
            },
          ],
        }),
        text: async () => '',
      };
    };

    const liveResult = await searchYouTubeCoursePlaylists({
      query: 'React JS',
      apiKey: 'test-key-123',
      maxResults: 8,
      fetchFn: mockApiFetch,
    });

    assert.ok(
      capturedEndpoint.startsWith(
        'https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&maxResults=8&q=React%20JS&key=test-key-123'
      )
    );
    assert.equal(liveResult.source, 'youtube_api');
    assert.equal(liveResult.results.length, 2);
    assert.equal(liveResult.results[0].title, 'React JS & Hooks Full Course');
    assert.equal(liveResult.results[0].channelTitle, 'Code & Architecture');
    assert.equal(
      liveResult.results[0].thumbnail,
      'https://i.ytimg.com/vi/RGKi6LSPDLU/hqdefault.jpg'
    );
    // Unsafe javascript: thumbnail must be replaced with safe HTTPS fallback
    assert.ok(liveResult.results[1].thumbnail.startsWith('https://'));
    assert.equal(
      sanitizeSafeHttpsUrl('javascript:alert(1)', 'https://example.com/fallback.jpg'),
      'https://example.com/fallback.jpg'
    );

    // 3. Quota exceeded (403) falls back cleanly to curated playlists
    const mockQuotaFetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: { errors: [{ reason: 'quotaExceeded' }] },
      }),
      text: async () => '',
    });

    const quotaFallback = await searchYouTubeCoursePlaylists({
      query: 'Python Full Course',
      apiKey: 'test-key-123',
      fetchFn: mockQuotaFetch,
    });
    assert.equal(quotaFallback.source, 'curated_fallback');
    assert.ok(quotaFallback.results.length >= 2);
    assert.ok(
      quotaFallback.results.some(r => r.title.toLowerCase().includes('python')),
      'Python Full Course search must return curated Python playlists'
    );

    // 4. Missing API key returns relevant curated playlists for React JS and DSA, and every curated playlist imports cleanly
    const reactFallback = await searchYouTubeCoursePlaylists({ query: 'React JS', apiKey: '' });
    assert.equal(reactFallback.source, 'curated_fallback');
    assert.ok(reactFallback.results.some(r => r.title.toLowerCase().includes('react')));

    const dsaFallback = searchCuratedYouTubePlaylists('DSA', 8);
    assert.ok(dsaFallback.some(r => r.title.toLowerCase().includes('dsa')));

    // Verify clicking Enroll on a curated React playlist resolves multi-lesson verified tracks
    const discoveredReact = await discoverYouTubePlaylist({
      inputUrl: `https://www.youtube.com/playlist?list=${reactFallback.results[0].playlistId}`,
      apiKey: '',
      fetchFn: async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => '' }),
    });
    assert.equal(discoveredReact.status, 'playlist_found');
    assert.ok(discoveredReact.selectedPlaylist);
    assert.ok(discoveredReact.selectedPlaylist!.lessons.length >= 5);
  });
});



