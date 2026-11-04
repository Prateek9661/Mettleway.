import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Search,
  Download,
  FileText,
  FileJson,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Check,
  X,
  Play,
} from 'lucide-react';
import { Tracker, Lesson } from '../types';
import {
  searchAndFilterCourseNotes,
  exportCourseNotesToMarkdown,
  exportCourseNotesToJson,
  formatSecondsToTimestamp,
  EnrichedCourseNote,
} from '../utils/studyWorkspaceLogic';

interface PersonalVideoNotesPanelProps {
  tracker: Tracker;
  currentLesson: Lesson;
  currentLessonIndex: number;
  elapsedSessionSeconds?: number;
  onAddNote: (params: {
    lessonId: string;
    content: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
  }) => void;
  onUpdateNote: (params: {
    lessonId: string;
    noteId: string;
    content: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
  }) => void;
  onDeleteNote: (lessonId: string, noteId: string) => void;
  onToggleBookmarkNote: (lessonId: string, noteId: string) => void;
  onSeekToTimestamp: (seconds: number, lessonId: string) => void;
}

export const PersonalVideoNotesPanel: React.FC<PersonalVideoNotesPanelProps> = ({
  tracker,
  currentLesson,
  currentLessonIndex,
  elapsedSessionSeconds = 0,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onToggleBookmarkNote,
  onSeekToTimestamp,
}) => {
  // New note form state
  const [noteContent, setNoteContent] = useState<string>('');
  const [timestampInput, setTimestampInput] = useState<string>('02:15');
  const [conceptTag, setConceptTag] = useState<string>(
    currentLesson.keyConcepts?.[0] || 'Core Concept'
  );
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // Filter & search state
  const [scopeFilter, setScopeFilter] = useState<'current_video' | 'all_course' | 'bookmarked'>(
    'current_video'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editTimestamp, setEditTimestamp] = useState<string>('00:00');
  const [editConceptTag, setEditConceptTag] = useState<string>('');
  const [editBookmarked, setEditBookmarked] = useState<boolean>(false);

  // Export feedback state
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null);

  // Sync default conceptTag when lesson switches
  React.useEffect(() => {
    setConceptTag(currentLesson.keyConcepts?.[0] || 'Core Concept');
  }, [currentLesson.id, currentLesson.keyConcepts]);

  const filteredNotes: EnrichedCourseNote[] = useMemo(() => {
    return searchAndFilterCourseNotes(tracker, {
      lessonId: scopeFilter === 'current_video' ? currentLesson.id : undefined,
      onlyBookmarked: scopeFilter === 'bookmarked',
      searchQuery,
    });
  }, [tracker, currentLesson.id, scopeFilter, searchQuery]);

  const allCourseNotesCount = useMemo(
    () => searchAndFilterCourseNotes(tracker).length,
    [tracker]
  );

  const currentVideoNotesCount = useMemo(
    () => searchAndFilterCourseNotes(tracker, { lessonId: currentLesson.id }).length,
    [tracker, currentLesson.id]
  );

  const bookmarkedCount = useMemo(
    () => searchAndFilterCourseNotes(tracker, { onlyBookmarked: true }).length,
    [tracker]
  );

  const handleCaptureCurrentTimestamp = () => {
    const fallbackSeconds = elapsedSessionSeconds > 0 ? elapsedSessionSeconds : 300;
    setTimestampInput(formatSecondsToTimestamp(fallbackSeconds));
  };

  const handleCreateNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteContent.trim();
    if (!trimmed) return;

    onAddNote({
      lessonId: currentLesson.id,
      content: trimmed,
      timestampInput: timestampInput.trim() || '00:00',
      isBookmarked,
      conceptTag: conceptTag.trim() || currentLesson.keyConcepts?.[0] || 'Key Concept',
    });

    setNoteContent('');
    setIsBookmarked(false);
  };

  const handleStartEditing = (note: EnrichedCourseNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditTimestamp(note.formattedTimestamp);
    setEditConceptTag(note.conceptTag || '');
    setEditBookmarked(note.isBookmarked);
  };

  const handleSaveEdit = (lessonId: string, noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    onUpdateNote({
      lessonId,
      noteId,
      content: trimmed,
      timestampInput: editTimestamp,
      isBookmarked: editBookmarked,
      conceptTag: editConceptTag,
    });
    setEditingNoteId(null);
  };

  const triggerFileDownload = (filename: string, content: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback for restricted environments
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).catch(() => {});
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleExportMarkdown = () => {
    const md = exportCourseNotesToMarkdown(tracker, {
      lessonId: scopeFilter === 'current_video' ? currentLesson.id : undefined,
      onlyBookmarked: scopeFilter === 'bookmarked',
    });
    const safeSlug = tracker.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    triggerFileDownload(`${safeSlug || 'course'}-notes.md`, md, 'text/markdown;charset=utf-8');
    setExportStatusMessage('Notes exported as Markdown (.md) and copied to clipboard.');
    setTimeout(() => setExportStatusMessage(null), 3500);
  };

  const handleExportJson = () => {
    const json = exportCourseNotesToJson(tracker, {
      lessonId: scopeFilter === 'current_video' ? currentLesson.id : undefined,
      onlyBookmarked: scopeFilter === 'bookmarked',
    });
    const safeSlug = tracker.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    triggerFileDownload(`${safeSlug || 'course'}-notes.json`, json, 'application/json;charset=utf-8');
    setExportStatusMessage('Notes exported as JSON (.json) and copied to clipboard.');
    setTimeout(() => setExportStatusMessage(null), 3500);
  };

  return (
    <div
      id="personal-video-notes-panel"
      className="pt-5 border-t border-slate-200 space-y-4"
    >
      {/* Header Row: Title + Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Personal Video Notes &amp; Concept Bookmarks</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Create timestamped notes for Lecture {currentLessonIndex + 1}, bookmark important concepts, and click any timestamp to jump the video player.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Download study notes as Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Notes (.md)</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Download study notes as JSON (.json)"
          >
            <FileJson className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export (.json)</span>
          </button>
        </div>
      </div>

      {exportStatusMessage && (
        <div
          role="status"
          className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center justify-between"
        >
          <span>{exportStatusMessage}</span>
          <button
            type="button"
            onClick={() => setExportStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Dismiss export status"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Timestamped Note Form */}
      <form
        onSubmit={handleCreateNoteSubmit}
        className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Timestamp Input + Quick Capture */}
          <div className="sm:col-span-4 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={timestampInput}
                onChange={e => setTimestampInput(e.target.value)}
                placeholder="MM:SS (e.g. 04:30)"
                aria-label="Video timestamp MM:SS"
                className="w-full pl-8 pr-2.5 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={handleCaptureCurrentTimestamp}
              className="px-2.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Capture current study timer timestamp"
            >
              Now
            </button>
          </div>

          {/* Concept Tag Input */}
          <div className="sm:col-span-5">
            <input
              type="text"
              value={conceptTag}
              onChange={e => setConceptTag(e.target.value)}
              placeholder="Concept tag (e.g. Time Complexity, B+ Tree)"
              aria-label="Concept tag"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
            />
          </div>

          {/* Bookmark Important Concept Toggle */}
          <div className="sm:col-span-3 flex items-center">
            <button
              type="button"
              onClick={() => setIsBookmarked(prev => !prev)}
              aria-pressed={isBookmarked}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isBookmarked
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500 text-amber-600' : ''}`}
              />
              <span>{isBookmarked ? 'Bookmarked' : 'Bookmark Concept'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            placeholder="Write a timestamped video note, formula, or code takeaway..."
            aria-label="Personal video note content"
            className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Video Note</span>
          </button>
        </div>
      </form>

      {/* Search & Scope Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Interactive Scope Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setScopeFilter('current_video')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              scopeFilter === 'current_video'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Video ({currentVideoNotesCount})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('all_course')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              scopeFilter === 'all_course'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Course Notes ({allCourseNotesCount})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('bookmarked')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 ${
              scopeFilter === 'bookmarked'
                ? 'bg-white text-amber-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-3 h-3 text-amber-600" />
            <span>Bookmarked ({bookmarkedCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes, concepts, or timestamps..."
            aria-label="Search personal notes"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
          />
        </div>
      </div>

      {/* Notes List */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
        {filteredNotes.length === 0 ? (
          <div className="p-6 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-700">
              {searchQuery
                ? 'No notes match your search query'
                : scopeFilter === 'bookmarked'
                ? 'No bookmarked concept notes yet'
                : 'No timestamped notes saved for this lecture yet'}
            </p>
            <p className="text-[11px] text-slate-500">
              Add a timestamp and key takeaway above to build your searchable personal study notebook.
            </p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const isEditing = editingNoteId === note.id;

            if (isEditing) {
              return (
                <div key={note.id} className="p-3.5 bg-indigo-50/40 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editTimestamp}
                      onChange={e => setEditTimestamp(e.target.value)}
                      aria-label="Edit timestamp"
                      className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={editConceptTag}
                      onChange={e => setEditConceptTag(e.target.value)}
                      placeholder="Concept tag"
                      aria-label="Edit concept tag"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setEditBookmarked(prev => !prev)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        editBookmarked
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {editBookmarked ? '★ Bookmarked Concept' : '☆ Bookmark Concept'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    aria-label="Edit note content"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(null)}
                      className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(note.lessonId, note.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Note</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={note.id}
                className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Clickable Timestamp Button that seeks the embedded video player */}
                    <button
                      type="button"
                      onClick={() => onSeekToTimestamp(note.timestampSeconds, note.lessonId)}
                      className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                      title={`Jump video player to ${note.formattedTimestamp}`}
                    >
                      <Play className="w-3 h-3 fill-indigo-600" />
                      <span>{note.formattedTimestamp}</span>
                    </button>

                    {note.conceptTag && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-700">{note.conceptTag}</span>
                      </>
                    )}

                    {note.isBookmarked && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-amber-700 font-semibold">★ Bookmarked Concept</span>
                      </>
                    )}

                    {scopeFilter !== 'current_video' && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-slate-500 truncate max-w-xs">
                          Lec {note.lessonIndex + 1}: {note.lessonTitle}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed">{note.content}</p>
                </div>

                {/* Note Actions: Bookmark Toggle, Edit, Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleBookmarkNote(note.lessonId, note.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      note.isBookmarked
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                    }`}
                    title={
                      note.isBookmarked ? 'Remove concept bookmark' : 'Bookmark important concept'
                    }
                    aria-label={
                      note.isBookmarked ? 'Remove concept bookmark' : 'Bookmark important concept'
                    }
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${note.isBookmarked ? 'fill-amber-500' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditing(note)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit note"
                    aria-label={`Edit note ${note.formattedTimestamp}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.lessonId, note.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete note"
                    aria-label={`Delete note ${note.formattedTimestamp}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
