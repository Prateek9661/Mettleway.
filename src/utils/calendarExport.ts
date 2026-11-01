import { Tracker, Lesson } from '../types';

export interface ScheduledSessionEvent {
  id: string;
  date: Date;
  dateString: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  moduleTitle: string;
  lessonTitle: string;
  keyConcepts: string[];
  practiceTask?: string;
  videoUrl?: string;
  trackerTitle: string;
  lessonId: string;
}

export interface CalendarExportOptions {
  reminderMinutes?: number; // 10, 15, 30
  weeksCount?: number;
  sessionLimit?: number;
  includeCompleted?: boolean;
}

/**
 * Escapes characters for iCalendar (RFC 5545) text fields
 */
function escapeICSText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Helper to pad numbers with leading zero
 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Formats a Date object into local floating iCalendar format: YYYYMMDDTHHmm00
 */
function formatLocalICSDateTime(date: Date, timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr || '20', 10);
  const m = parseInt(mStr || '0', 10);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(h);
  const minute = pad(m);

  return `${year}${month}${day}T${hour}${minute}00`;
}

/**
 * Calculates end time string (HH:mm) given a start time and duration in minutes
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hStr, mStr] = startTime.split(':');
  const startH = parseInt(hStr || '20', 10);
  const startM = parseInt(mStr || '0', 10);

  const totalMin = startH * 60 + startM + durationMinutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;

  return `${pad(endH)}:${pad(endM)}`;
}

/**
 * Calculates end date and time for a given Date, start time, and duration
 */
function calculateEndDate(date: Date, startTime: string, durationMinutes: number): Date {
  const [hStr, mStr] = startTime.split(':');
  const startH = parseInt(hStr || '20', 10);
  const startM = parseInt(mStr || '0', 10);

  const endDate = new Date(date);
  endDate.setHours(startH, startM + durationMinutes, 0, 0);
  return endDate;
}

/**
 * Computes the specific upcoming study sessions mapped to actual lessons
 * based on the student's scheduled study days and scheduled time.
 */
export function calculateUpcomingSessions(
  tracker: Tracker,
  options: CalendarExportOptions = {}
): ScheduledSessionEvent[] {
  const { includeCompleted = false, sessionLimit = 30 } = options;

  // Gather lessons in order
  const orderedLessons: Array<{ lesson: Lesson; moduleTitle: string }> = [];
  tracker.modules.forEach(mod => {
    mod.lessons.forEach(lesson => {
      if (includeCompleted || !lesson.completed) {
        orderedLessons.push({ lesson, moduleTitle: mod.title });
      }
    });
  });

  if (orderedLessons.length === 0) {
    return [];
  }

  const studyDays = tracker.studyDays.length > 0 ? tracker.studyDays : [1, 2, 3, 4, 5, 6];
  const startTime = tracker.scheduledTime || '20:00';
  const [schedH, schedM] = startTime.split(':').map(Number);

  const results: ScheduledSessionEvent[] = [];
  const currentDate = new Date();

  // If today is a study day, check if scheduled time has passed
  const currentDayOfWeek = currentDate.getDay();
  const currentTotalMin = currentDate.getHours() * 60 + currentDate.getMinutes();
  const targetTotalMin = (schedH || 20) * 60 + (schedM || 0);

  let cursorDate = new Date(currentDate);
  cursorDate.setHours(schedH || 20, schedM || 0, 0, 0);

  // If today is NOT a study day, or today's study time already passed, advance to tomorrow
  if (!studyDays.includes(currentDayOfWeek) || currentTotalMin >= targetTotalMin) {
    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  let lessonIndex = 0;
  let safetyCounter = 0;

  while (lessonIndex < orderedLessons.length && results.length < sessionLimit && safetyCounter < 180) {
    safetyCounter++;
    const dayOfWeek = cursorDate.getDay();

    if (studyDays.includes(dayOfWeek)) {
      const { lesson, moduleTitle } = orderedLessons[lessonIndex];
      const duration = lesson.durationMinutes || tracker.dailyMinutesTarget || 45;
      const endTime = calculateEndTime(startTime, duration);

      const year = cursorDate.getFullYear();
      const month = pad(cursorDate.getMonth() + 1);
      const day = pad(cursorDate.getDate());
      const dateString = `${year}-${month}-${day}`;

      results.push({
        id: `devtrack-session-${tracker.id}-${lesson.id}-${dateString}`,
        date: new Date(cursorDate),
        dateString,
        startTime,
        endTime,
        durationMinutes: duration,
        moduleTitle,
        lessonTitle: lesson.title,
        keyConcepts: lesson.keyConcepts || [],
        practiceTask: lesson.practiceTask,
        videoUrl: lesson.videoUrl,
        trackerTitle: tracker.title,
        lessonId: lesson.id,
      });

      lessonIndex++;
    }

    // Move to next day
    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  return results;
}

/**
 * Builds an RFC 5545 VEVENT string for a single session
 */
function buildVEventString(session: ScheduledSessionEvent, reminderMinutes: number = 15): string {
  const now = new Date();
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const dtStart = formatLocalICSDateTime(session.date, session.startTime);
  const dtEnd = formatLocalICSDateTime(session.date, session.endTime);

  const conceptsSummary = session.keyConcepts.length > 0 ? `Key Concepts:\n- ${session.keyConcepts.join('\n- ')}` : '';
  const practice = session.practiceTask ? `\nPractice Task: ${session.practiceTask}` : '';
  const video = session.videoUrl ? `\nStudy Resource: ${session.videoUrl}` : '';

  const description = [
    `DevTrack Study Session: ${session.lessonTitle}`,
    `Course: ${session.trackerTitle}`,
    `Module: ${session.moduleTitle}`,
    `Duration: ${session.durationMinutes} minutes`,
    conceptsSummary,
    practice,
    video,
    `\nTrack your progress in DevTrack.`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'BEGIN:VEVENT',
    `UID:${session.id}@devtrack.local`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(`DevTrack: ${session.lessonTitle}`)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText('DevTrack Study Workspace')}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminderMinutes}M`,
    `DESCRIPTION:${escapeICSText(`Study session starts in ${reminderMinutes} minutes: ${session.lessonTitle}`)}`,
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

/**
 * Generates a full .ICS file string containing multiple specific study sessions
 */
export function generateMultipleSessionsICS(
  sessions: ScheduledSessionEvent[],
  calendarName: string,
  reminderMinutes: number = 15
): string {
  const events = sessions.map(s => buildVEventString(s, reminderMinutes)).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DevTrack//Study Schedule Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(`DevTrack - ${calendarName}`)}`,
    'X-WR-TIMEZONE:UTC',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Triggers a browser file download of the given .ICS content
 */
export function triggerICSDownload(filename: string, icsContent: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports multiple sessions directly as an .ICS file
 */
export function exportSessionsToICS(
  sessions: ScheduledSessionEvent[],
  courseTitle: string,
  reminderMinutes: number = 15
) {
  if (sessions.length === 0) return;
  const icsContent = generateMultipleSessionsICS(sessions, courseTitle, reminderMinutes);
  const safeTitle = courseTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  triggerICSDownload(`DevTrack-${safeTitle}-Sessions.ics`, icsContent);
}

/**
 * Exports a single study session as an .ICS file
 */
export function exportSingleSessionToICS(
  session: ScheduledSessionEvent,
  reminderMinutes: number = 15
) {
  const icsContent = generateMultipleSessionsICS([session], session.trackerTitle, reminderMinutes);
  const safeName = session.lessonTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
  triggerICSDownload(`DevTrack-Session-${safeName}.ics`, icsContent);
}

/**
 * Generates an iCalendar (.ics) string for recurring study sessions (backward compatible)
 */
export function exportTrackerToICS(tracker: Tracker, weeksCount: number = 4, reminderMinutes: number = 15) {
  const now = new Date();
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const [targetHourStr, targetMinStr] = (tracker.scheduledTime || '20:00').split(':');
  const targetHour = parseInt(targetHourStr || '20', 10);
  const targetMinute = parseInt(targetMinStr || '0', 10);

  const durationMin = tracker.dailyMinutesTarget || 60;
  const endHour = Math.floor(targetHour + (targetMinute + durationMin) / 60) % 24;
  const endMinute = (targetMinute + durationMin) % 60;

  const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byDays = tracker.studyDays.map(d => dayMap[d]).join(',');

  const startDate = new Date();
  startDate.setHours(targetHour, targetMinute, 0, 0);

  const dtStart = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(targetHour)}${pad(targetMinute)}00`;
  const dtEnd = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(endHour)}${pad(endMinute)}00`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DevTrack//Study Schedule Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(`DevTrack Study Schedule - ${tracker.title}`)}`,
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VEVENT',
    `UID:devtrack-recurring-${tracker.id}-${Date.now()}@devtrack.local`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byDays || 'MO,TU,WE,TH,FR,SA'};COUNT=${weeksCount * (tracker.studyDays.length || 6)}`,
    `SUMMARY:${escapeICSText(`DevTrack: ${tracker.title}`)}`,
    `DESCRIPTION:${escapeICSText(`Daily dedicated study session for ${tracker.title}. Daily target: ${tracker.dailyMinutesTarget} mins. Stay consistent and keep your streak alive!`)}`,
    `LOCATION:${escapeICSText('DevTrack Workspace')}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminderMinutes}M`,
    `DESCRIPTION:${escapeICSText(`Study Session starts in ${reminderMinutes} minutes`)}`,
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const safeTitle = tracker.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  triggerICSDownload(`DevTrack-${safeTitle}-Schedule.ics`, icsContent);
}

/**
 * Generates a direct Web URL to add an event to Google Calendar
 */
export function getGoogleCalendarUrl(session: ScheduledSessionEvent): string {
  const [startH, startM] = session.startTime.split(':').map(Number);
  const [endH, endM] = session.endTime.split(':').map(Number);

  const startDate = new Date(session.date);
  startDate.setHours(startH, startM, 0, 0);

  const endDate = new Date(session.date);
  endDate.setHours(endH, endM, 0, 0);

  const formatGoogleDate = (d: Date) => {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const details = [
    `DevTrack Study Session: ${session.lessonTitle}`,
    `Course: ${session.trackerTitle}`,
    `Module: ${session.moduleTitle}`,
    `Target: ${session.durationMinutes} mins`,
    session.keyConcepts.length > 0 ? `Key Concepts: ${session.keyConcepts.join(', ')}` : '',
    session.practiceTask ? `Practice Task: ${session.practiceTask}` : '',
    session.videoUrl ? `Link: ${session.videoUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `DevTrack: ${session.lessonTitle}`,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: details,
    location: 'DevTrack Workspace',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a direct Web URL to add an event to Outlook (Personal or Office 365)
 */
export function getOutlookCalendarUrl(session: ScheduledSessionEvent, isOffice365: boolean = false): string {
  const [startH, startM] = session.startTime.split(':').map(Number);
  const [endH, endM] = session.endTime.split(':').map(Number);

  const startDate = new Date(session.date);
  startDate.setHours(startH, startM, 0, 0);

  const endDate = new Date(session.date);
  endDate.setHours(endH, endM, 0, 0);

  const details = [
    `DevTrack Study Session: ${session.lessonTitle}`,
    `Course: ${session.trackerTitle}`,
    `Module: ${session.moduleTitle}`,
    `Target: ${session.durationMinutes} mins`,
    session.keyConcepts.length > 0 ? `Key Concepts: ${session.keyConcepts.join(', ')}` : '',
    session.practiceTask ? `Practice Task: ${session.practiceTask}` : '',
    session.videoUrl ? `Link: ${session.videoUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const baseUrl = isOffice365
    ? 'https://outlook.office.com/calendar/0/deeplink/compose'
    : 'https://outlook.live.com/calendar/0/deeplink/compose';

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `DevTrack: ${session.lessonTitle}`,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    body: details,
    location: 'DevTrack Workspace',
  });

  return `${baseUrl}?${params.toString()}`;
}
