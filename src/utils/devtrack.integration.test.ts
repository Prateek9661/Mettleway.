import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDeepWorkToggle,
  calculateCourseProgress,
  getCurrentUncompletedLesson,
  generateDailyStudyChecklist,
  completeLessonInTracker,
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

