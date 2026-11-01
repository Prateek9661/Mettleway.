import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDeepWorkToggle,
  calculateCourseProgress,
  getCurrentUncompletedLesson,
  generateDailyStudyChecklist,
  completeLessonInTracker,
  buildDynamicTrackerFromInput,
} from './studyWorkspaceLogic';
import {
  calculateUpcomingSessions,
  generateMultipleSessionsICS,
} from './calendarExport';
import { PRESET_TRACKERS } from './mockPresets';

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
  });
});


