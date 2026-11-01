import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ExternalLink, ChevronDown, ChevronUp, FileText, Clock } from 'lucide-react';
import { Tracker } from '../types';
import { getCourseThemeTokens, resolveLessonVideoUrl } from '../utils/studyWorkspaceLogic';

interface CurriculumRoadmapProps {
  tracker: Tracker;
  onToggleLesson: (lessonId: string) => void;
  onUpdateNotes: (lessonId: string, notes: string) => void;
  onOpenCreateModal: () => void;
}

export const CurriculumRoadmap: React.FC<CurriculumRoadmapProps> = ({
  tracker,
  onToggleLesson,
  onUpdateNotes,
  onOpenCreateModal,
}) => {
  const [filter, setFilter] = useState<'all' | 'remaining' | 'completed'>('all');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tracker.modules.forEach(m => { initial[m.id] = true; });
    return initial;
  });
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  // Reset expanded modules and editing state whenever the active course changes
  useEffect(() => {
    const nextExpanded: Record<string, boolean> = {};
    tracker.modules.forEach(m => {
      nextExpanded[m.id] = true;
    });
    setExpandedModules(nextExpanded);
    setEditingNotesId(null);
  }, [tracker.id, tracker.sourceUrl]);

  // Compute statistics
  let totalLessons = 0;
  let completedLessons = 0;
  let totalMinutes = 0;
  let completedMinutes = 0;

  tracker.modules.forEach(m => {
    m.lessons.forEach(l => {
      totalLessons += 1;
      totalMinutes += l.durationMinutes;
      if (l.completed) {
        completedLessons += 1;
        completedMinutes += l.durationMinutes;
      }
    });
  });

  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const remainingMinutes = Math.max(totalMinutes - completedMinutes, 0);
  const daysToFinish = tracker.dailyMinutesTarget > 0 ? Math.ceil(remainingMinutes / tracker.dailyMinutesTarget) : 0;

  // Projected finish date
  const projectedFinishDate = new Date();
  projectedFinishDate.setDate(projectedFinishDate.getDate() + daysToFinish);

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Overview & Progress KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{tracker.category}</span>
              <span aria-hidden="true">·</span>
              <span>{tracker.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span>By {tracker.instructor}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {tracker.title}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              {tracker.description}
            </p>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="self-start md:self-auto px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Change / Import Track
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Curriculum Progress</span>
            <span className={`font-mono tabular-nums font-bold ${getCourseThemeTokens(tracker.category).accentText}`}>
              {completedLessons} of {totalLessons} Lessons ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${getCourseThemeTokens(tracker.category).progressBg} transition-all duration-500 rounded-full`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 4-column KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 block">Total Study Time</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
              {Math.round(totalMinutes / 60)} hrs ({totalMinutes}m)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Completed Time</span>
            <span className="font-bold text-emerald-600 font-mono tabular-nums text-sm">
              {Math.round(completedMinutes / 60)} hrs ({completedMinutes}m)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Daily Pacing</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
              {tracker.dailyMinutesTarget}m / day
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Projected Completion</span>
            <span className="font-bold text-indigo-600 font-mono tabular-nums text-sm">
              {remainingMinutes === 0 ? 'Completed!' : projectedFinishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Lessons ({totalLessons})
          </button>
          <button
            onClick={() => setFilter('remaining')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filter === 'remaining' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Remaining ({totalLessons - completedLessons})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filter === 'completed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({completedLessons})
          </button>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Click checkbox to mark lesson status
        </span>
      </div>

      {/* Modules List */}
      <div className="space-y-6">
        {tracker.modules.map((mod, modIdx) => {
          const visibleLessons = mod.lessons.filter(l => {
            if (filter === 'remaining') return !l.completed;
            if (filter === 'completed') return l.completed;
            return true;
          });

          if (visibleLessons.length === 0 && filter !== 'all') {
            return null;
          }

          const isExpanded = !!expandedModules[mod.id];
          const modCompletedCount = mod.lessons.filter(l => l.completed).length;

          return (
            <div
              key={mod.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Module Header */}
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Module {modIdx + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{modCompletedCount}/{mod.lessons.length} Completed</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mod.description}
                    </p>
                  )}
                </div>

                <div className="p-1 text-slate-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {/* Module Lessons Table / List */}
              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {visibleLessons.map(lesson => (
                    <div
                      key={lesson.id}
                      className={`p-4 sm:px-6 transition-colors ${
                        lesson.completed ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => onToggleLesson(lesson.id)}
                          className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                          title={lesson.completed ? 'Mark uncompleted' : 'Mark completed'}
                        >
                          {lesson.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                          )}
                        </button>

                        {/* Lesson Info */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4
                              className={`text-sm font-semibold ${
                                lesson.completed ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {lesson.title}
                            </h4>
                            <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {lesson.durationMinutes}m
                            </span>
                          </div>

                          {/* Concepts unboxed metadata */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span>Key concepts:</span>
                            {lesson.keyConcepts.map((concept, cIdx) => (
                              <React.Fragment key={cIdx}>
                                <span className="text-slate-700 font-medium">{concept}</span>
                                {cIdx < lesson.keyConcepts.length - 1 && <span aria-hidden="true">·</span>}
                              </React.Fragment>
                            ))}
                          </div>

                          {lesson.practiceTask && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <strong className="text-slate-700">Practice:</strong> {lesson.practiceTask}
                            </p>
                          )}

                          {/* Notes view or editor */}
                          {editingNotesId === lesson.id ? (
                            <div className="pt-2 space-y-2">
                              <textarea
                                defaultValue={lesson.notes || ''}
                                id={`notes-${lesson.id}`}
                                rows={2}
                                placeholder="Add your personal notes, code patterns, or questions for this lesson..."
                                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNotesId(null)}
                                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = (document.getElementById(`notes-${lesson.id}`) as HTMLTextAreaElement)?.value;
                                    onUpdateNotes(lesson.id, val || '');
                                    setEditingNotesId(null);
                                  }}
                                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700"
                                >
                                  Save Notes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 pt-1 text-xs">
                              <a
                                href={
                                  tracker.id === 'tracker-dsa-striver' || tracker.id === 'tracker-fullstack-mern'
                                    ? lesson.videoUrl
                                    : resolveLessonVideoUrl(
                                        tracker.sourceUrl,
                                        lesson.videoUrl,
                                        modIdx * 3,
                                        tracker.title,
                                        lesson.title
                                      )
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Watch Video</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => setEditingNotesId(lesson.id)}
                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{lesson.notes ? 'Edit Notes' : 'Add Notes'}</span>
                              </button>

                              {lesson.notes && (
                                <span className="text-slate-400 italic truncate max-w-xs">
                                  "{lesson.notes}"
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
