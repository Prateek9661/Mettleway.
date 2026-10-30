import { Tracker } from '../types';

/**
 * Generates an iCalendar (.ics) string for the scheduled study sessions
 * and triggers a download in the browser.
 */
export function exportTrackerToICS(tracker: Tracker, weeksCount: number = 4) {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const [targetHourStr, targetMinStr] = tracker.scheduledTime.split(':');
  const targetHour = parseInt(targetHourStr || '20', 10);
  const targetMinute = parseInt(targetMinStr || '0', 10);

  const durationMin = tracker.dailyMinutesTarget || 60;
  const endHour = Math.floor(targetHour + (targetMinute + durationMin) / 60) % 24;
  const endMinute = (targetMinute + durationMin) % 60;

  // Map numbers to ICS RRULE days: 0 -> SU, 1 -> MO, 2 -> TU, 3 -> WE, 4 -> TH, 5 -> FR, 6 -> SA
  const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byDays = tracker.studyDays.map(d => dayMap[d]).join(',');

  // Start date from today
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
    'X-WR-CALNAME:DevTrack Study Schedule',
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VEVENT',
    `UID:devtrack-${tracker.id}-${Date.now()}@devtrack.local`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byDays || 'MO,TU,WE,TH,FR,SA'};COUNT=${weeksCount * (tracker.studyDays.length || 6)}`,
    `SUMMARY:DevTrack: ${tracker.title}`,
    `DESCRIPTION:Daily dedicated study session for ${tracker.title}. Daily goal: ${tracker.dailyMinutesTarget} minutes. Powered by DevTrack.`,
    'LOCATION:DevTrack Workspace',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'DESCRIPTION:Study Session starts in 10 minutes',
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `DevTrack-${tracker.title.replace(/[^a-zA-Z0-9]/g, '_')}-Schedule.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
