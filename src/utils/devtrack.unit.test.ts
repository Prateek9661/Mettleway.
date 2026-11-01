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
} from './studyWorkspaceLogic';
import {
  calculateUpcomingSessions,
  generateMultipleSessionsICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from './calendarExport';
import { buildSmartConceptFallback } from './aiMentorCache';
import { PRESET_TRACKERS } from './mockPresets';
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

describe('Unit Tests: AI Concept Mentor Professor & Interviewer Fallback Engine (TDD)', () => {
  test('buildSmartConceptFallback returns real-world analogy, line-by-line code, and interview perspective', () => {
    const lesson = PRESET_TRACKERS[0].modules[0].lessons[1]; // Hashing lesson
    const result = buildSmartConceptFallback(
      PRESET_TRACKERS[0].title,
      lesson,
      'Why is unordered_map O(1) for Two Sum?',
      'DSA'
    );

    assert.ok(result.directAnswer.length > 20);
    assert.ok(result.realWorldAnalogy?.includes('Real-World Example:'));
    assert.equal(result.codeExample?.language, 'C++');
    assert.ok((result.codeExample?.lineByLine?.length || 0) >= 4);
    assert.ok(result.interviewPerspective?.actualInterviewQuestion.includes('Interviewer asks:'));
    assert.ok(result.interviewPerspective?.whatInterviewerExpects.length);
  });
});

describe('Unit Tests: SEO Metadata, Visible H1, robots.txt, and sitemap.xml (TDD)', () => {
  test('index.html contains full SEO metadata targeting "DevTrack - Dev Track App", Open Graph tags, JSON-LD, and visible H1 with "DevTrack"', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Target keyword in title and meta description
    assert.match(html, /<title>.*DevTrack - Dev Track App.*<\/title>/i);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]*DevTrack - Dev Track App[^"]*"/i);
    assert.match(html, /<meta\s+name="keywords"\s+content="[^"]*DevTrack - Dev Track App[^"]*"/i);

    // Open Graph & Twitter tags
    assert.match(html, /<meta\s+property="og:title"\s+content="[^"]*DevTrack - Dev Track App[^"]*"/i);
    assert.match(html, /<meta\s+property="og:description"\s+content="[^"]*DevTrack - Dev Track App[^"]*"/i);
    assert.match(html, /<meta\s+property="og:type"\s+content="website"/i);
    assert.match(html, /<meta\s+property="og:site_name"\s+content="DevTrack - Dev Track App"/i);
    assert.match(html, /<meta\s+name="twitter:card"\s+content="summary_large_image"/i);
    assert.match(html, /<meta\s+name="twitter:title"\s+content="[^"]*DevTrack - Dev Track App[^"]*"/i);

    // Schema.org JSON-LD WebApplication
    assert.match(html, /<script\s+type="application\/ld\+json">/i);
    assert.ok(html.includes('"@type": "WebApplication"'));

    // Google Site Verification meta tag
    assert.ok(
      html.includes('<meta name="google-site-verification" content="0X0iN0C9MXiS0_ZLInyDcriTOEsujydnaBL18vhttGo" />')
    );

    // Visible H1 heading containing 'DevTrack'
    assert.match(html, /<h1[^>]*>[\s\S]*?DevTrack[\s\S]*?<\/h1>/i);
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

