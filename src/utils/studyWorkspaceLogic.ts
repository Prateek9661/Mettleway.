import { Tracker, Lesson, StudyTask } from '../types';

export type NavTab = 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule';

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
