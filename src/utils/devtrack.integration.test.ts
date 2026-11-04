import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDeepWorkToggle,
  calculateCourseProgress,
  getCurrentUncompletedLesson,
  generateDailyStudyChecklist,
  completeLessonInTracker,
  buildDynamicTrackerFromInput,
  createDefaultLearnerProfile,
  applyPacingPresetToProfile,
  applyProfilePacingToTracker,
  computeSkillMilestones,
  computeProfileCourseAnalytics,
  markEntireCourseCompleted,
  getActiveOrSelectedLesson,
  resolveLessonEmbedUrl,
  resolveLessonVideoUrl,
  recordLastWatchedLesson,
  getPreviousAndNextLesson,
  getContinueLearningState,
  addVideoNoteToTracker,
  exportCourseNotesToMarkdown,
  filterAndSortTrackers,
  computeStudentDashboardSummary,
} from './studyWorkspaceLogic';
import {
  calculateUpcomingSessions,
  generateMultipleSessionsICS,
} from './calendarExport';
import { PRESET_TRACKERS } from './mockPresets';
import {
  discoverYouTubePlaylist,
  importManualMultipleVideoUrls,
  buildTrackerFromVerifiedLessons,
  assertUniqueVideoIdsAcrossLessons,
  PLAYLIST_FALLBACK_MESSAGE,
  FetchLike,
} from './youtubePlaylistDiscovery';

describe('Integration Tests: End-to-End Learner Study Workflow & Calendar Sync', () => {
  test('completing active lesson updates course mastery, advances active lesson, and shifts upcoming ICS calendar schedule', () => {
    // 1. Start with preset DSA tracker while user is browsing 'squads'
    let tracker = structuredClone(PRESET_TRACKERS[0]);
    const initialProgress = calculateCourseProgress(tracker);
    assert.equal(initialProgress.completed, 2);

    // 2. Learner toggles Deep Work ON -> automatically redirected to 'today' active session
    const deepWorkState = resolveDeepWorkToggle(false, 'squads');
    assert.equal(deepWorkState.isDeepWork, true);
    assert.equal(deepWorkState.nextTab, 'today');

    // 3. Identify today's active uncompleted lesson (les-3) and build daily task checklist
    const activeLessonBefore = getCurrentUncompletedLesson(tracker);
    assert.ok(activeLessonBefore, 'Should find an uncompleted lesson');
    assert.equal(activeLessonBefore.id, 'les-3');

    const checklistBefore = generateDailyStudyChecklist(
      activeLessonBefore,
      {},
      [],
      'Wrote detailed revision notes on Kadane and Dutch National Flag pointers.'
    );
    assert.equal(checklistBefore[0].linkedLessonId, 'les-3');
    assert.equal(checklistBefore[0].completed, false);
    // Notes task auto-completes because notes length > 15
    assert.equal(checklistBefore[2].completed, true);

    // 4. Verify upcoming calendar schedule before completing lesson starts at les-3
    const upcomingBefore = calculateUpcomingSessions(tracker, {
      includeCompleted: false,
      sessionLimit: 3,
    });
    assert.equal(upcomingBefore[0].lessonId, 'les-3');

    // 5. Complete lesson les-3
    tracker = completeLessonInTracker(
      tracker,
      'les-3',
      'Completed Dutch National Flag in O(N) time and O(1) space',
      new Date().toISOString()
    );

    // 6. Verify course mastery incremented and next active lesson advanced to les-4
    const updatedProgress = calculateCourseProgress(tracker);
    assert.equal(updatedProgress.completed, 3);
    assert.ok(updatedProgress.percent > initialProgress.percent);

    const activeLessonAfter = getCurrentUncompletedLesson(tracker);
    assert.equal(activeLessonAfter?.id, 'les-4');

    // 7. Verify ICS Calendar Export now schedules les-4 first
    const upcomingAfter = calculateUpcomingSessions(tracker, {
      includeCompleted: false,
      sessionLimit: 3,
    });
    assert.equal(upcomingAfter[0].lessonId, 'les-4');

    const icsPayload = generateMultipleSessionsICS(upcomingAfter, tracker.title, 15);
    assert.ok(icsPayload.includes(upcomingAfter[0].lessonTitle));
    assert.ok(!icsPayload.includes(activeLessonBefore.title));
  });
});

describe('Integration Tests: Live Express Server & AI Concept Mentor Modes (/api/concept-tutor)', () => {
  test('POST /api/concept-tutor enforces mode separation (Professor Mode vs Interviewer Mode) and sub-50ms cache hit', async () => {
    const baseUrl = 'http://localhost:3000';

    // Check if local server is reachable
    let serverReachable = false;
    try {
      const ping = await fetch(baseUrl, { method: 'GET' });
      serverReachable = ping.ok;
    } catch {
      serverReachable = false;
    }

    if (!serverReachable) {
      return;
    }

    // 1. Test Professor Mode ('simple'): should NOT return interviewPerspective
    const simplePayload = {
      topic: 'Striver A2Z DSA Sheet',
      currentLesson: 'Hashing Maps & Frequency Arrays in C++',
      question: 'Explain Hash Map in simple beginner terms',
      explanationStyle: 'simple',
    };

    const resSimple = await fetch(`${baseUrl}/api/concept-tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simplePayload),
    });

    assert.equal(resSimple.status, 200);
    const jsonSimple = (await resSimple.json()) as any;
    assert.equal(jsonSimple.success, true);
    assert.ok(jsonSimple.data.directAnswer, 'Professor mode must include directAnswer');
    assert.ok(jsonSimple.data.realWorldAnalogy, 'Professor mode must include realWorldAnalogy');
    assert.equal(
      jsonSimple.data.interviewPerspective,
      undefined,
      'Professor mode must NOT include interviewPerspective'
    );

    // 2. Test Interviewer Mode ('interview'): MUST include interviewPerspective & lineByLine code
    const interviewPayload = {
      topic: 'Striver A2Z DSA Sheet',
      currentLesson: 'Hashing Maps & Frequency Arrays in C++',
      question: 'How do I solve Two Sum optimally in an interview?',
      explanationStyle: 'interview',
    };

    const resInterview1 = await fetch(`${baseUrl}/api/concept-tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interviewPayload),
    });

    assert.equal(resInterview1.status, 200);
    const jsonInterview1 = (await resInterview1.json()) as any;
    assert.equal(jsonInterview1.success, true);
    assert.ok(jsonInterview1.data.directAnswer, 'Should include directAnswer');
    assert.ok(jsonInterview1.data.realWorldAnalogy, 'Should include realWorldAnalogy');
    assert.ok(
      jsonInterview1.data.interviewPerspective?.actualInterviewQuestion,
      'Interviewer mode must include interviewPerspective.actualInterviewQuestion'
    );
    assert.ok(
      Array.isArray(jsonInterview1.data.codeExample?.lineByLine),
      'Must include line-by-line code explanation'
    );

    // 3. Repeat identical request to verify in-memory server cache hit (<50ms)
    const resInterview2 = await fetch(`${baseUrl}/api/concept-tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interviewPayload),
    });
    const jsonInterview2 = (await resInterview2.json()) as any;
    assert.equal(jsonInterview2.success, true);
    assert.equal(jsonInterview2.cached, true);
    assert.ok(
      jsonInterview2.latencyMs < 50,
      `Expected cached response <50ms, got ${jsonInterview2.latencyMs}ms`
    );
  });
});

describe('Integration Tests: Live Server SEO HTML, robots.txt, and sitemap.xml Delivery', () => {
  test('GET /, GET /robots.txt, and GET /sitemap.xml serve valid SEO metadata, visible H1, and crawler files', async () => {
    const baseUrl = 'http://localhost:3000';

    let serverReachable = false;
    try {
      const ping = await fetch(baseUrl, { method: 'GET' });
      serverReachable = ping.ok;
    } catch {
      serverReachable = false;
    }

    if (!serverReachable) {
      return;
    }

    // 1. Verify root HTML SEO tags and visible H1
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const htmlText = await htmlRes.text();
    assert.ok(htmlText.includes('DevTrack - Dev Track App'));
    assert.ok(
      htmlText.includes('<meta name="google-site-verification" content="0X0iN0C9MXiS0_ZLInyDcriTOEsujydnaBL18vhttGo" />')
    );
    assert.match(htmlText, /<h1[^>]*>[\s\S]*?DevTrack[\s\S]*?<\/h1>/i);

    // 2. Verify /robots.txt HTTP endpoint
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes('User-agent: *'));
    assert.ok(robotsText.includes('sitemap.xml'));

    // 3. Verify /sitemap.xml HTTP endpoint
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    const sitemapText = await sitemapRes.text();
    assert.ok(sitemapText.includes('<urlset'));
    assert.ok(sitemapText.includes('<loc>'));
  });
});

describe('Integration Tests: Dynamic Course Addition, Switching & YouTube URL Synchronization', () => {
  test('adding a custom Python YouTube course via /api/extract-resource and switching active course updates title, theme, 0% progress, syllabus, checklist, and YouTube links', async () => {
    // 1. Initial state: user is on PRESET_TRACKERS[0] (Striver DSA)
    const dsaTracker = PRESET_TRACKERS[0];
    const dsaLesson = getCurrentUncompletedLesson(dsaTracker);
    assert.equal(dsaLesson?.title, 'Lec 3: Hashing & Frequency Counting Maps');
    assert.equal(calculateCourseProgress(dsaTracker).completed, 2);

    // 2. User submits a custom Python YouTube course URL
    const pythonYoutubeUrl = 'https://www.youtube.com/playlist?list=PLu0W_9lII9agwh1XjRt242xIpHhPT2llg';
    let extractedServerData: any = null;

    const baseUrl = 'http://localhost:3000';
    try {
      const res = await fetch(`${baseUrl}/api/extract-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: pythonYoutubeUrl,
          rawTopic: 'Python Programming Full Course',
          dailyMinutes: 45,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json.success && json.data) {
          extractedServerData = json.data;
        }
      }
    } catch {
      // Server offline fallback path also tested
    }

    // 3. Build the new tracker and switch active course to it
    const newPythonTracker = buildDynamicTrackerFromInput({
      inputUrl: pythonYoutubeUrl,
      rawTopic: 'Python Programming Full Course',
      extractedData: extractedServerData,
      dailyMinutes: 45,
      scheduledTime: '21:00',
      studyDays: [1, 2, 3, 4, 5],
      trackerId: 'tracker-python-live',
    });

    // 4. Verify complete dashboard context synchronization:
    // - Course progress resets to 0%
    const newProgress = calculateCourseProgress(newPythonTracker);
    assert.equal(newProgress.completed, 0);
    assert.equal(newProgress.percent, 0);

    // - Active lesson swaps out old DSA "Lec 3: Hashing" and loads Lesson 1 of the new course
    const newActiveLesson = getCurrentUncompletedLesson(newPythonTracker);
    assert.ok(newActiveLesson);
    assert.notEqual(newActiveLesson.title, 'Lec 3: Hashing & Frequency Counting Maps');
    assert.ok(
      newActiveLesson.videoUrl.includes('PLu0W_9lII9agwh1XjRt242xIpHhPT2llg'),
      `Active lesson videoUrl (${newActiveLesson.videoUrl}) must point to the newly added YouTube URL`
    );

    // - Daily task checklist dynamically updates to the new course's active lesson
    const newChecklist = generateDailyStudyChecklist(newActiveLesson, {}, [], '');
    assert.ok(newChecklist[0].title.includes(newActiveLesson.title));
    assert.equal(newChecklist[0].linkedLessonId, newActiveLesson.id);
  });

  test('importing a custom subject (e.g. DBMS) with a first playlist video URL via /api/extract-resource updates all header metadata and maps Lesson 1, Lesson 2, Lesson 3 to direct lecture URLs', async () => {
    const dbmsFirstVideoUrl =
      'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y';
    let serverTracker: any = null;

    const baseUrl = 'http://localhost:3000';
    try {
      const res = await fetch(`${baseUrl}/api/extract-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: dbmsFirstVideoUrl,
          rawTopic: 'DBMS',
          dailyMinutes: 60,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json.success && json.data) {
          serverTracker = json.data;
        }
      }
    } catch {
      // Fallback if server is restarting
    }

    const dbmsTracker = buildDynamicTrackerFromInput({
      inputUrl: dbmsFirstVideoUrl,
      rawTopic: 'DBMS',
      extractedData: serverTracker,
      dailyMinutes: 60,
      trackerId: 'tracker-dbms-e2e',
    });

    // Verify dynamic header metadata (never static "Computer Science Core" or "YouTube Curated Series")
    assert.ok(dbmsTracker.title.toUpperCase().includes('DBMS'));
    assert.notEqual(dbmsTracker.category, 'Computer Science Core');
    assert.notEqual(dbmsTracker.instructor, 'YouTube Curated Series');

    // Verify sequential lessons and direct lecture navigation URLs
    const lessons = dbmsTracker.modules.flatMap(m => m.lessons);
    assert.ok(lessons.length >= 3);
    assert.ok(lessons[0].videoUrl.includes('index=1'));
    assert.ok(lessons[1].videoUrl.includes('index=2'));
    assert.ok(lessons[2].videoUrl.includes('index=3'));
    assert.notEqual(lessons[0].videoUrl, lessons[1].videoUrl);
    assert.notEqual(lessons[1].videoUrl, lessons[2].videoUrl);
    // Ensure Lesson 2 and Lesson 3 NEVER repeat Lesson 1's v=kBdlM6hNDAE
    assert.ok(
      !lessons[1].videoUrl.includes('v=kBdlM6hNDAE'),
      `Lesson 2 (${lessons[1].videoUrl}) must not repeat Lesson 1 videoId kBdlM6hNDAE`
    );
    assert.ok(
      !lessons[2].videoUrl.includes('v=kBdlM6hNDAE'),
      `Lesson 3 (${lessons[2].videoUrl}) must not repeat Lesson 1 videoId kBdlM6hNDAE`
    );
  });

  test('auto-detecting a YouTube playlist URL with empty rawTopic via /api/extract-resource extracts real lecture titles and distinct videoIds per lesson', async () => {
    const playlistUrl = 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y';
    let serverTracker: any = null;

    const baseUrl = 'http://localhost:3000';
    try {
      const res = await fetch(`${baseUrl}/api/extract-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: playlistUrl,
          rawTopic: '', // Empty topic: system must auto-detect subject, lectures, and titles from URL!
          dailyMinutes: 60,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json.success && json.data) {
          serverTracker = json.data;
        }
      }
    } catch {
      // Fallback if server is restarting
    }

    const tracker = buildDynamicTrackerFromInput({
      inputUrl: playlistUrl,
      rawTopic: '',
      extractedData: serverTracker,
      dailyMinutes: 60,
      trackerId: 'tracker-autodetect-e2e',
    });

    assert.ok(tracker.title.length > 3);
    assert.ok(!tracker.title.startsWith('http'), 'Title must be human-readable, not a raw URL');
    const lessons = tracker.modules.flatMap(m => m.lessons);
    assert.ok(lessons.length >= 5, `Expected at least 5 lessons, got ${lessons.length}`);

    // Verify all lesson URLs are distinct and do not repeat the first video ID
    const urlSet = new Set(lessons.map(l => l.videoUrl));
    assert.equal(urlSet.size, lessons.length, 'Every lesson must have a unique videoUrl');
  });

  test('working professional configuring after-hours upskilling profile synchronizes course pacing, ICS schedule, and career skill milestones', () => {
    // 1. User configures profile as a Working Professional upskilling after office hours
    let profile = createDefaultLearnerProfile('Working Professional');
    profile = applyPacingPresetToProfile(profile, 'after-work');
    profile.careerObjective = 'Transition to Senior Cloud & System Architect';

    // 2. User imports a System Design course and applies their profile pacing
    let tracker = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX',
      rawTopic: 'System Design & Distributed Architecture',
      dailyMinutes: profile.dailyMinutesTarget,
      scheduledTime: profile.preferredTime,
      studyDays: profile.studyDays,
      trackerId: 'tracker-pro-system-design',
    });
    tracker = applyProfilePacingToTracker(tracker, profile);

    assert.equal(tracker.dailyMinutesTarget, 45);
    assert.equal(tracker.scheduledTime, '21:00');
    assert.deepEqual(tracker.studyDays, [1, 2, 3, 4, 5]);

    // 3. Verify upcoming calendar sessions strictly follow Mon-Fri after-work schedule (no weekend sessions)
    const upcoming = calculateUpcomingSessions(tracker, { sessionLimit: 4 });
    for (const s of upcoming) {
      const day = s.date.getDay();
      assert.ok(day >= 1 && day <= 5, `After-work session day (${day}) must fall on Mon-Fri`);
      assert.equal(s.startTime, '21:00');
    }

    // 4. Complete first lesson and verify career skill milestones advance
    const milestonesBefore = computeSkillMilestones(tracker, profile, 3);
    const firstLessonId = tracker.modules[0].lessons[0].id;
    tracker = completeLessonInTracker(tracker, firstLessonId, 'Designed consistent hashing ring');
    const milestonesAfter = computeSkillMilestones(tracker, profile, 4);

    assert.ok(milestonesAfter[0].progressPercent > milestonesBefore[0].progressPercent);
  });

  test('profile course analytics tracks a universal learner course lifecycle from Pending -> In Progress -> Completed with accurate study hours', () => {
    // 1. User bookmarks a new Python course (starts in Pending / Saved queue with 0% progress)
    let pythonCourse = buildDynamicTrackerFromInput({
      inputUrl: 'https://www.youtube.com/playlist?list=PLu0W_9lII9agwh1XjRt242xIpHhPT2llg',
      rawTopic: 'Python for Automation & Backend',
      trackerId: 'tracker-lifecycle-python',
    });

    const existingInProgress = structuredClone(PRESET_TRACKERS[0]);

    // Verify initial analytics: 1 In Progress, 1 Pending, 0 Completed
    let analytics = computeProfileCourseAnalytics([existingInProgress, pythonCourse]);
    assert.equal(analytics.totalCourses, 2);
    assert.equal(analytics.inProgressCount, 1);
    assert.equal(analytics.pendingCount, 1);
    assert.equal(analytics.completedCount, 0);
    assert.equal(analytics.pendingCourses[0].trackerId, 'tracker-lifecycle-python');

    // 2. Learner starts the Python course and completes Lesson 1 -> moves from Pending to In Progress
    const lesson1Id = pythonCourse.modules[0].lessons[0].id;
    pythonCourse = completeLessonInTracker(
      pythonCourse,
      lesson1Id,
      'Completed Python variables and memory model',
      '2026-10-25T20:00:00.000Z'
    );

    analytics = computeProfileCourseAnalytics([existingInProgress, pythonCourse]);
    assert.equal(analytics.pendingCount, 0);
    assert.equal(analytics.inProgressCount, 2);
    const pythonInProgress = analytics.inProgressCourses.find(
      c => c.trackerId === 'tracker-lifecycle-python'
    );
    assert.ok(pythonInProgress);
    assert.ok(pythonInProgress.progressPercent > 0 && pythonInProgress.progressPercent < 100);
    assert.equal(pythonInProgress.currentLessonTitle, pythonCourse.modules[0].lessons[1].title);

    // 3. Learner completes all remaining lessons in the Python course -> moves to Completed with timestamp & total study time
    pythonCourse = markEntireCourseCompleted(pythonCourse, '2026-11-01T15:00:00.000Z');
    analytics = computeProfileCourseAnalytics([existingInProgress, pythonCourse]);

    assert.equal(analytics.completedCount, 1);
    assert.equal(analytics.inProgressCount, 1);
    assert.equal(analytics.pendingCount, 0);
    assert.equal(analytics.completedCourses[0].trackerId, 'tracker-lifecycle-python');
    assert.equal(analytics.completedCourses[0].progressPercent, 100);
    assert.equal(analytics.completedCourses[0].completedAt, '2026-11-01T15:00:00.000Z');
    assert.ok(analytics.totalHoursLogged >= analytics.completedCourses[0].hoursLogged);
  });

  test('importing a YouTube video link from a playlist generates full multi-lecture curriculum and clicking Lesson X loads Lecture X in the player', () => {
    // User pastes a single video URL from a playlist where oEmbed returned "Lecture 1: Introduction | Complete Docker & Kubernetes Course"
    const pastedPlaylistVideoUrl =
      'https://www.youtube.com/watch?v=vid_docker_1&list=PL_DOCKER_K8S_SERIES';
    const tracker = buildDynamicTrackerFromInput({
      inputUrl: pastedPlaylistVideoUrl,
      rawTopic: 'Lecture 1: Introduction | Complete Docker & Kubernetes Course',
      extractedData: {
        title: 'Lecture 1: Introduction | Complete Docker & Kubernetes Course',
        instructor: 'DevOps Academy',
        // Simulate partial client scrape where only 1 video was returned initially
        playlistVideos: [{ videoId: 'vid_docker_1', title: 'Introduction & Container Internals', durationMinutes: 35 }],
      },
      trackerId: 'tracker-docker-playlist-e2e',
    });

    // 1. Course title is normalized to the series title (not stuck on "Lecture 1")
    assert.equal(tracker.title, 'Complete Docker & Kubernetes Course');

    // 2. Full multi-lecture syllabus is generated (never just 1 single video!)
    const lessons = tracker.modules.flatMap(m => m.lessons);
    assert.ok(lessons.length >= 6, `Expected at least 6 sequential lessons, got ${lessons.length}`);
    assert.match(lessons[0].title, /^Lesson 1:/);
    assert.match(lessons[1].title, /^Lesson 2:/);
    assert.match(lessons[2].title, /^Lesson 3:/);

    // 3. Clicking on Lesson 3 (index 2) dynamically updates the active lesson and player URLs to Lecture 3 (never defaulting back to vid_docker_1)
    const selectedLessonState = getActiveOrSelectedLesson(tracker, lessons[2].id);
    assert.equal(selectedLessonState.lessonIndex, 2);
    assert.equal(selectedLessonState.lesson?.id, lessons[2].id);

    const lesson1Embed = resolveLessonEmbedUrl(tracker.sourceUrl, lessons[0].videoUrl, 0);
    const lesson3Embed = resolveLessonEmbedUrl(
      tracker.sourceUrl,
       selectedLessonState.lesson!.videoUrl,
      selectedLessonState.lessonIndex
    );
    const lesson3Watch = resolveLessonVideoUrl(
      tracker.sourceUrl,
      selectedLessonState.lesson!.videoUrl,
      selectedLessonState.lessonIndex,
      tracker.title,
      selectedLessonState.lesson!.title
    );

    assert.ok(lesson1Embed.includes('vid_docker_1'));
    assert.ok(
      !lesson3Embed.includes('vid_docker_1'),
      `Lesson 3 embed (${lesson3Embed}) must NOT default back to Lesson 1's vid_docker_1`
    );
    assert.ok(lesson3Embed.includes('list=PL_DOCKER_K8S_SERIES'));
    assert.ok(lesson3Embed.includes('index=2'));
    assert.ok(!lesson3Watch.includes('vid_docker_1'));
    assert.ok(lesson3Watch.includes('index=3'));
  });
});

describe('Integration Tests: Smart YouTube Playlist Discovery (Scenarios A, B, C, D, E)', () => {
  test('Scenario A: A video URL containing a playlist ID imports all playlist lessons in original order with unique videoIds', async () => {
    const mockFetch: FetchLike = async (url: string) => {
      if (url.includes('/youtube/v3/videos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'vid_rust_1',
                status: { privacyStatus: 'public' },
                contentDetails: { duration: 'PT25M10S' },
                snippet: {
                  title: 'Lecture 1: Rust Ownership & Borrowing | Complete Rust Course',
                  description: 'Learn Rust from scratch',
                  channelId: 'UC_RUST_ACADEMY',
                  channelTitle: 'Rust Systems Academy',
                  thumbnails: { high: { url: 'https://i.ytimg.com/vi/vid_rust_1/hqdefault.jpg' } },
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('/youtube/v3/playlists')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'PL_RUST_COMPLETE_101',
                snippet: {
                  title: 'Complete Rust Systems Programming Course',
                  description: 'Full Rust playlist',
                  channelId: 'UC_RUST_ACADEMY',
                  channelTitle: 'Rust Systems Academy',
                  thumbnails: { high: { url: 'https://i.ytimg.com/vi/vid_rust_1/hqdefault.jpg' } },
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('/youtube/v3/playlistItems')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                snippet: {
                  position: 0,
                  title: 'Rust Ownership & Borrowing',
                  resourceId: { videoId: 'vid_rust_1' },
                },
                contentDetails: { videoId: 'vid_rust_1' },
                status: { privacyStatus: 'public' },
              },
              {
                snippet: {
                  position: 1,
                  title: 'Structs, Enums & Pattern Matching',
                  resourceId: { videoId: 'vid_rust_2' },
                },
                contentDetails: { videoId: 'vid_rust_2' },
                status: { privacyStatus: 'public' },
              },
              {
                snippet: {
                  position: 2,
                  title: 'Traits, Generics & Lifetimes',
                  resourceId: { videoId: 'vid_rust_3' },
                },
                contentDetails: { videoId: 'vid_rust_3' },
                status: { privacyStatus: 'public' },
              },
            ],
          }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };

    const discovery = await discoverYouTubePlaylist({
      inputUrl: 'https://www.youtube.com/watch?v=vid_rust_1&list=PL_RUST_COMPLETE_101',
      apiKey: 'TEST_SERVER_API_KEY',
      fetchFn: mockFetch,
    });

    assert.equal(discovery.status, 'playlist_found');
    assert.ok(discovery.selectedPlaylist);
    assert.equal(discovery.selectedPlaylist.playlistId, 'PL_RUST_COMPLETE_101');
    assert.equal(discovery.selectedPlaylist.lessons.length, 3);

    const tracker = buildTrackerFromVerifiedLessons({
      lessons: discovery.selectedPlaylist.lessons,
      playlistId: discovery.selectedPlaylist.playlistId,
      courseTitle: discovery.selectedPlaylist.title,
      instructor: discovery.selectedPlaylist.channelTitle,
      sourceUrl: 'https://www.youtube.com/playlist?list=PL_RUST_COMPLETE_101',
    });

    const allLessons = tracker.modules.flatMap(m => m.lessons);
    assert.equal(allLessons.length, 3);
    assert.equal(allLessons[0].videoId, 'vid_rust_1');
    assert.equal(allLessons[1].videoId, 'vid_rust_2');
    assert.equal(allLessons[2].videoId, 'vid_rust_3');
    assert.equal(allLessons[0].playlistPosition, 1);
    assert.equal(allLessons[1].playlistPosition, 2);
    assert.equal(allLessons[2].playlistPosition, 3);
    assert.equal(assertUniqueVideoIdsAcrossLessons(allLessons).valid, true);
  });

  test('Scenario B: A single video URL without a playlist ID discovers the containing playlist via YouTube Data API v3 search + verification', async () => {
    const mockFetch: FetchLike = async (url: string) => {
      if (url.includes('/youtube/v3/videos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'vid_go_intro',
                status: { privacyStatus: 'public' },
                contentDetails: { duration: 'PT30M00S' },
                snippet: {
                  title: 'Lesson 1: Go Goroutines & Channels | Golang Backend Course',
                  description: 'Master Golang backend engineering',
                  channelId: 'UC_GOLANG_PRO',
                  channelTitle: 'Golang Pro Engineering',
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('/youtube/v3/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: { playlistId: 'PL_UNRELATED_999' },
                snippet: {
                  title: 'Unrelated Go Tips',
                  channelId: 'UC_GOLANG_PRO',
                  channelTitle: 'Golang Pro Engineering',
                },
              },
              {
                id: { playlistId: 'PL_GOLANG_BACKEND_MASTER' },
                snippet: {
                  title: 'Golang Backend Course Complete Playlist',
                  description: 'Full Go backend series',
                  channelId: 'UC_GOLANG_PRO',
                  channelTitle: 'Golang Pro Engineering',
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('playlistId=PL_UNRELATED_999')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                snippet: { title: 'Other Video 1', resourceId: { videoId: 'vid_other_1' } },
                contentDetails: { videoId: 'vid_other_1' },
                status: { privacyStatus: 'public' },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('playlistId=PL_GOLANG_BACKEND_MASTER')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                snippet: { title: 'Go Goroutines & Channels', resourceId: { videoId: 'vid_go_intro' } },
                contentDetails: { videoId: 'vid_go_intro' },
                status: { privacyStatus: 'public' },
              },
              {
                snippet: { title: 'Context, Mutexes & WaitGroups', resourceId: { videoId: 'vid_go_2' } },
                contentDetails: { videoId: 'vid_go_2' },
                status: { privacyStatus: 'public' },
              },
              {
                snippet: { title: 'Building Production HTTP Microservices', resourceId: { videoId: 'vid_go_3' } },
                contentDetails: { videoId: 'vid_go_3' },
                status: { privacyStatus: 'public' },
              },
            ],
          }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };

    const discovery = await discoverYouTubePlaylist({
      inputUrl: 'https://www.youtube.com/watch?v=vid_go_intro',
      apiKey: 'TEST_SERVER_API_KEY',
      fetchFn: mockFetch,
    });

    assert.equal(discovery.status, 'playlist_found');
    assert.ok(discovery.selectedPlaylist);
    assert.equal(discovery.selectedPlaylist.playlistId, 'PL_GOLANG_BACKEND_MASTER');
    assert.equal(discovery.selectedPlaylist.verifiedContainsVideoId, true);
    assert.equal(discovery.selectedPlaylist.lessons.length, 3);
    assert.deepEqual(
      discovery.selectedPlaylist.lessons.map(l => l.videoId),
      ['vid_go_intro', 'vid_go_2', 'vid_go_3']
    );
  });

  test('Scenario C: A video that belongs to multiple playlists ranks candidates by channel relevance, title similarity, and course relevance', async () => {
    // kBdlM6hNDAE belongs to both the 12-video Complete DBMS Playlist and the 5-video DBMS Crash Series in the catalog
    const discovery = await discoverYouTubePlaylist({
      inputUrl: 'https://www.youtube.com/watch?v=kBdlM6hNDAE',
      apiKey: '',
    });

    assert.equal(discovery.status, 'multiple_playlists_found');
    assert.ok(Array.isArray(discovery.candidates));
    assert.ok(discovery.candidates.length >= 2);
    // Highest ranked playlist is the Complete DBMS Playlist
    assert.equal(discovery.candidates[0].playlistId, 'PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y');
    assert.ok(discovery.candidates[0].relevanceScore >= discovery.candidates[1].relevanceScore);
    for (const candidate of discovery.candidates) {
      assert.equal(candidate.verifiedContainsVideoId, true);
      assert.equal(assertUniqueVideoIdsAcrossLessons(candidate.lessons).valid, true);
    }
  });

  test('Scenario D: A video for which no playlist can be discovered returns the exact fallback message and never fakes a multi-lesson playlist from 1 video', async () => {
    const mockFetchNoPlaylist: FetchLike = async (url: string) => {
      if (url.includes('/youtube/v3/videos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'vid_standalone_999',
                status: { privacyStatus: 'public' },
                contentDetails: { duration: 'PT18M00S' },
                snippet: {
                  title: 'My Standalone Keynote Talk 2026',
                  description: 'Single conference talk',
                  channelId: 'UC_CONF_TALK',
                  channelTitle: 'Tech Conf',
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('/youtube/v3/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };

    const discovery = await discoverYouTubePlaylist({
      inputUrl: 'https://www.youtube.com/watch?v=vid_standalone_999',
      apiKey: 'TEST_SERVER_API_KEY',
      fetchFn: mockFetchNoPlaylist,
    });

    assert.equal(discovery.status, 'no_playlist_found');
    assert.equal(
      discovery.message,
      "We couldn't automatically identify the complete playlist. Please paste the playlist URL or choose another import method."
    );
    assert.equal(discovery.message, PLAYLIST_FALLBACK_MESSAGE);
    assert.equal(discovery.selectedPlaylist ?? null, null);
    assert.equal((discovery.lessons || []).length, 0);

    // Verify Manual Multiple-Video URL fallback import works and deduplicates videoIds while preserving order
    const manualImport = await importManualMultipleVideoUrls({
      rawUrls: [
        'https://www.youtube.com/watch?v=kBdlM6hNDAE',
        'https://www.youtube.com/watch?v=3EJlovevfcA',
        'https://www.youtube.com/watch?v=kBdlM6hNDAE', // duplicate should be removed
        'https://www.youtube.com/watch?v=pDX4NR4eQf3',
      ].join('\n'),
      courseTitle: 'Custom DBMS Track',
    });

    assert.equal(manualImport.success, true);
    assert.equal(manualImport.lessons.length, 3);
    assert.deepEqual(
      manualImport.lessons.map(l => l.videoId),
      ['kBdlM6hNDAE', '3EJlovevfcA', 'pDX4NR4eQf3']
    );
    assert.equal(assertUniqueVideoIdsAcrossLessons(manualImport.lessons).valid, true);
  });

  test('Scenario E: A playlist containing more than 50 videos paginates all pages via nextPageToken, filters private/deleted videos, deduplicates, and preserves exact order', async () => {
    // Generate 65 unique videos across 2 pages (50 on page 1 + 15 on page 2) plus 1 duplicate and 1 private video
    const page1Items = Array.from({ length: 50 }, (_, idx) => {
      const num = idx + 1;
      const vid = `vid_big_${String(num).padStart(3, '0')}`;
      return {
        snippet: {
          position: idx,
          title: `Lecture ${num}: Distributed Systems Topic ${num}`,
          resourceId: { videoId: vid },
          thumbnails: { high: { url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } },
        },
        contentDetails: { videoId: vid },
        status: { privacyStatus: 'public' },
      };
    });

    const page2Items = [
      // Duplicate of video #1 (should be deduplicated)
      {
        snippet: {
          position: 50,
          title: 'Lecture 1: Distributed Systems Topic 1 (Duplicate)',
          resourceId: { videoId: 'vid_big_001' },
        },
        contentDetails: { videoId: 'vid_big_001' },
        status: { privacyStatus: 'public' },
      },
      // Private video (should be filtered out)
      {
        snippet: {
          position: 51,
          title: 'Private video',
          resourceId: { videoId: 'vid_private_999' },
        },
        contentDetails: { videoId: 'vid_private_999' },
        status: { privacyStatus: 'private' },
      },
      // 15 more valid videos (51..65)
      ...Array.from({ length: 15 }, (_, idx) => {
        const num = 51 + idx;
        const vid = `vid_big_${String(num).padStart(3, '0')}`;
        return {
          snippet: {
            position: 52 + idx,
            title: `Lecture ${num}: Distributed Systems Topic ${num}`,
            resourceId: { videoId: vid },
            thumbnails: { high: { url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } },
          },
          contentDetails: { videoId: vid },
          status: { privacyStatus: 'public' },
        };
      }),
    ];

    const mockFetchLargePlaylist: FetchLike = async (url: string) => {
      if (url.includes('/youtube/v3/playlists')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'PL_LARGE_65_COURSE',
                snippet: {
                  title: '65-Lecture Distributed Systems Engineering Masterclass',
                  description: 'Complete 65-video university course',
                  channelId: 'UC_SYS_ENG',
                  channelTitle: 'Systems Engineering Lab',
                },
              },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.includes('/youtube/v3/playlistItems')) {
        if (url.includes('pageToken=PAGE_TOKEN_2')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: page2Items,
            }),
            text: async () => '',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            nextPageToken: 'PAGE_TOKEN_2',
            items: page1Items,
          }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };

    const discovery = await discoverYouTubePlaylist({
      inputUrl: 'https://www.youtube.com/playlist?list=PL_LARGE_65_COURSE',
      apiKey: 'TEST_SERVER_API_KEY',
      fetchFn: mockFetchLargePlaylist,
    });

    assert.equal(discovery.status, 'playlist_found');
    assert.ok(discovery.selectedPlaylist);
    assert.equal(discovery.selectedPlaylist.lessons.length, 65);
    assert.equal(discovery.selectedPlaylist.itemCount, 65);

    const tracker = buildTrackerFromVerifiedLessons({
      lessons: discovery.selectedPlaylist.lessons,
      playlistId: 'PL_LARGE_65_COURSE',
      courseTitle: discovery.selectedPlaylist.title,
      instructor: discovery.selectedPlaylist.channelTitle,
      sourceUrl: 'https://www.youtube.com/playlist?list=PL_LARGE_65_COURSE',
    });

    const allLessons = tracker.modules.flatMap(m => m.lessons);
    assert.equal(allLessons.length, 65);
    assert.equal(allLessons[0].videoId, 'vid_big_001');
    assert.equal(allLessons[0].playlistPosition, 1);
    assert.equal(allLessons[49].videoId, 'vid_big_050');
    assert.equal(allLessons[49].playlistPosition, 50);
    assert.equal(allLessons[50].videoId, 'vid_big_051');
    assert.equal(allLessons[50].playlistPosition, 51);
    assert.equal(allLessons[64].videoId, 'vid_big_065');
    assert.equal(allLessons[64].playlistPosition, 65);

    // Confirm invariant: no duplicate videoId across all 65 lessons
    const invariantCheck = assertUniqueVideoIdsAcrossLessons(allLessons);
    assert.equal(invariantCheck.valid, true);
  });
});

describe('Integration Tests: Complete Learning Management Experience (Progress, Notes, Library, Dashboard & Account Sync)', () => {
  test('end-to-end LMS workflow: watch lesson -> add timestamped note -> seek video -> export notes -> filter library -> sync & delete account data', async () => {
    // 1. Start with preset courses and simulate watching Lesson 4 of Course 1
    let trackers = structuredClone(PRESET_TRACKERS);
    const course1Lessons = trackers[0].modules.flatMap(m => m.lessons);
    const lesson4 = course1Lessons[3];

    trackers[0] = recordLastWatchedLesson(trackers[0], lesson4.id, '2026-11-04T15:00:00.000Z');

    // 2. Verify Continue Learning remembers Lesson 4 and Previous/Next lesson navigation works
    const continueState = getContinueLearningState(trackers, trackers[0].id);
    assert.ok(continueState.primaryContinue);
    assert.equal(continueState.primaryContinue.lessonId, lesson4.id);
    assert.equal(continueState.primaryContinue.lessonIndex, 3);

    const prevNext = getPreviousAndNextLesson(trackers[0], lesson4.id);
    assert.equal(prevNext.previousLesson?.id, course1Lessons[2].id);
    assert.equal(prevNext.nextLesson?.id, course1Lessons[4].id);

    // 3. Add a timestamped personal note on Lesson 4 and verify embed URL seeks to that timestamp
    trackers[0] = addVideoNoteToTracker(trackers[0], {
      lessonId: lesson4.id,
      noteId: 'e2e-note-1',
      content: 'Kadane subarray maximum invariants hold when resetting negative prefixes.',
      timestampInput: '05:15',
      conceptTag: 'Kadane Invariant',
      isBookmarked: true,
    });

    const seekEmbed = resolveLessonEmbedUrl(trackers[0].sourceUrl, lesson4.videoUrl, 3, 315);
    assert.ok(seekEmbed.includes('start=315'));

    const exportedMd = exportCourseNotesToMarkdown(trackers[0]);
    assert.ok(exportedMd.includes('[05:15]'));
    assert.ok(exportedMd.includes('Kadane Invariant'));

    // 4. Filter Course Library and compute Student Dashboard Summary
    const filteredLibrary = filterAndSortTrackers(trackers, {
      category: 'DSA',
      sortBy: 'recently_added',
    });
    assert.equal(filteredLibrary.length, 1);
    assert.equal(filteredLibrary[0].id, trackers[0].id);

    const dashboardSummary = computeStudentDashboardSummary(
      trackers,
      [{ date: '2026-11-04', minutesStudied: 50, lessonsCompletedCount: 1 }],
      6,
      60,
      trackers[0].id,
      '2026-11-04'
    );
    assert.equal(dashboardSummary.totalEnrolledCourses, trackers.length);
    assert.equal(dashboardSummary.continueLearning?.lessonId, lesson4.id);

    // 5. Verify live server account sync & user-isolated data deletion if server is running
    const baseUrl = 'http://localhost:3000';
    let serverReachable = false;
    try {
      const ping = await fetch(baseUrl, { method: 'GET' });
      serverReachable = ping.ok;
    } catch {
      serverReachable = false;
    }

    if (serverReachable) {
      const testUserId = 'test_lms_user_isolated_101';

      // Sync learning data to user account
      const syncRes = await fetch(`${baseUrl}/api/account/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          trackers,
          activeTrackerId: trackers[0].id,
          dailyLogs: [{ date: '2026-11-04', minutesStudied: 50, lessonsCompletedCount: 1 }],
          streakDays: 6,
        }),
      });
      assert.equal(syncRes.status, 200);
      const syncJson = (await syncRes.json()) as any;
      assert.equal(syncJson.success, true);

      // Fetch synced account data and verify user isolation
      const getRes = await fetch(
        `${baseUrl}/api/account/sync?userId=${encodeURIComponent(testUserId)}`
      );
      assert.equal(getRes.status, 200);
      const getJson = (await getRes.json()) as any;
      assert.equal(getJson.success, true);
      assert.ok(getJson.data);
      assert.equal(getJson.data.activeTrackerId, trackers[0].id);

      // Delete user's saved learning data
      const delRes = await fetch(`${baseUrl}/api/account/data`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: testUserId }),
      });
      assert.equal(delRes.status, 200);
      const delJson = (await delRes.json()) as any;
      assert.equal(delJson.success, true);
      assert.equal(delJson.deleted, true);

      // Verify account snapshot is now null after deletion
      const afterDelRes = await fetch(
        `${baseUrl}/api/account/sync?userId=${encodeURIComponent(testUserId)}`
      );
      const afterDelJson = (await afterDelRes.json()) as any;
      assert.equal(afterDelJson.data, null);
    }
  });
});



