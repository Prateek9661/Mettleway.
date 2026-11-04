import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Code2,
  List,
  Bold,
  Heading,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FolderTree,
} from 'lucide-react';
import { Tracker, Lesson, NoteTag, NoteSaveStatus } from '../types';
import {
  searchAndFilterCourseNotes,
  exportCourseNotesToMarkdown,
  exportCourseNotesToJson,
  formatSecondsToTimestamp,
  EnrichedCourseNote,
  NOTE_TAG_PRESETS,
} from '../utils/studyWorkspaceLogic';

interface PersonalVideoNotesPanelProps {
  tracker: Tracker;
  currentLesson: Lesson;
  currentLessonIndex: number;
  elapsedSessionSeconds?: number;
  userId?: string;
  onAddNote: (params: {
    noteId?: string;
    userId?: string;
    lessonId: string;
    heading?: string;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
    tags?: NoteTag[];
  }) => void;
  onUpdateNote: (params: {
    lessonId: string;
    noteId: string;
    heading?: string;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    timestampInput: string;
    isBookmarked: boolean;
    conceptTag: string;
    tags?: NoteTag[];
  }) => void;
  onDeleteNote: (lessonId: string, noteId: string) => void;
  onToggleBookmarkNote: (lessonId: string, noteId: string) => void;
  onSeekToTimestamp: (seconds: number, lessonId: string) => void;
  onOpenNotesLibrary?: () => void;
}

export const PersonalVideoNotesPanel: React.FC<PersonalVideoNotesPanelProps> = ({
  tracker,
  currentLesson,
  currentLessonIndex,
  elapsedSessionSeconds = 0,
  userId = 'default-learner',
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onToggleBookmarkNote,
  onSeekToTimestamp,
  onOpenNotesLibrary,
}) => {
  // Active note composer state (supports automatic debounced saving + manual "Save & New Note")
  const [activeDraftNoteId, setActiveDraftNoteId] = useState<string>(
    () => `note-${currentLesson.id}-${Date.now()}`
  );
  const [noteHeading, setNoteHeading] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [showCodeEditor, setShowCodeEditor] = useState<boolean>(false);
  const [codeSnippet, setCodeSnippet] = useState<string>('');
  const [codeLanguage, setCodeLanguage] = useState<string>('typescript');
  const [timestampInput, setTimestampInput] = useState<string>('02:15');
  const [conceptTag, setConceptTag] = useState<string>(
    currentLesson.keyConcepts?.[0] || 'Core Concept'
  );
  const [selectedTags, setSelectedTags] = useState<NoteTag[]>(['Important']);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // Auto-save status indicator state
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('saved');
  const [lastSavedTimeLabel, setLastSavedTimeLabel] = useState<string>('');
  const isDirtyRef = useRef<boolean>(false);

  // Filter & search state
  const [scopeFilter, setScopeFilter] = useState<'current_video' | 'all_course' | 'bookmarked'>(
    'current_video'
  );
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing existing saved note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editCodeSnippet, setEditCodeSnippet] = useState<string>('');
  const [editCodeLanguage, setEditCodeLanguage] = useState<string>('typescript');
  const [editTimestamp, setEditTimestamp] = useState<string>('00:00');
  const [editConceptTag, setEditConceptTag] = useState<string>('');
  const [editTags, setEditTags] = useState<NoteTag[]>([]);
  const [editBookmarked, setEditBookmarked] = useState<boolean>(false);

  // Export feedback state
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null);

  // Reset composer draft ID when switching lectures so each lecture gets its own clean composer
  useEffect(() => {
    setActiveDraftNoteId(`note-${currentLesson.id}-${Date.now()}`);
    setNoteHeading('');
    setNoteContent('');
    setCodeSnippet('');
    setShowCodeEditor(false);
    setConceptTag(currentLesson.keyConcepts?.[0] || 'Core Concept');
    setSaveStatus('saved');
    isDirtyRef.current = false;
  }, [currentLesson.id, tracker.id]);

  // Prevent accidental data loss before page unload when a note is mid-typing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Debounced Auto-Save (~600ms) while watching lecture
  useEffect(() => {
    const trimmedContent = noteContent.trim();
    const trimmedHeading = noteHeading.trim();
    const trimmedCode = codeSnippet.trim();

    if (!trimmedContent && !trimmedHeading && !trimmedCode) {
      isDirtyRef.current = false;
      return;
    }

    isDirtyRef.current = true;
    setSaveStatus('saving');

    const timer = setTimeout(() => {
      try {
        const effectiveContent =
          trimmedContent ||
          trimmedHeading ||
          `Code snippet (${codeLanguage})`;

        onAddNote({
          noteId: activeDraftNoteId,
          userId,
          lessonId: currentLesson.id,
          heading: trimmedHeading,
          content: effectiveContent,
          codeSnippet: trimmedCode,
          codeLanguage,
          timestampInput: timestampInput.trim() || '00:00',
          isBookmarked,
          conceptTag: conceptTag.trim() || currentLesson.keyConcepts?.[0] || 'Key Concept',
          tags: selectedTags,
        });

        isDirtyRef.current = false;
        setSaveStatus('autosaved');
        setLastSavedTimeLabel(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch {
        setSaveStatus('error');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    noteHeading,
    noteContent,
    codeSnippet,
    codeLanguage,
    timestampInput,
    isBookmarked,
    conceptTag,
    selectedTags,
    activeDraftNoteId,
    currentLesson.id,
  ]);

  const filteredNotes: EnrichedCourseNote[] = useMemo(() => {
    return searchAndFilterCourseNotes(tracker, {
      lessonId: scopeFilter === 'current_video' ? currentLesson.id : undefined,
      onlyBookmarked: scopeFilter === 'bookmarked',
      tag: tagFilter === 'all' ? undefined : tagFilter,
      searchQuery,
    });
  }, [tracker, currentLesson.id, scopeFilter, tagFilter, searchQuery]);

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

  const handleToggleTag = (tag: NoteTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleInsertFormatting = (prefix: string, suffix: string = '') => {
    setNoteContent(prev => {
      const next = prev ? `${prev}\n${prefix}${suffix}` : `${prefix}${suffix}`;
      return next;
    });
  };

  // Commit current note immediately and reset composer for a brand-new note
  const handleCreateNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = noteContent.trim();
    const trimmedHeading = noteHeading.trim();
    const trimmedCode = codeSnippet.trim();
    if (!trimmedContent && !trimmedHeading && !trimmedCode) return;

    const effectiveContent =
      trimmedContent || trimmedHeading || `Code snippet (${codeLanguage})`;

    onAddNote({
      noteId: activeDraftNoteId,
      userId,
      lessonId: currentLesson.id,
      heading: trimmedHeading,
      content: effectiveContent,
      codeSnippet: trimmedCode,
      codeLanguage,
      timestampInput: timestampInput.trim() || '00:00',
      isBookmarked,
      conceptTag: conceptTag.trim() || currentLesson.keyConcepts?.[0] || 'Key Concept',
      tags: selectedTags,
    });

    // Reset composer with a fresh note ID so the next note is a new entry
    setActiveDraftNoteId(`note-${currentLesson.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    setNoteHeading('');
    setNoteContent('');
    setCodeSnippet('');
    setIsBookmarked(false);
    isDirtyRef.current = false;
    setSaveStatus('saved');
    setLastSavedTimeLabel(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  };

  const handleStartEditing = (note: EnrichedCourseNote) => {
    setEditingNoteId(note.id);
    setEditHeading(note.heading || '');
    setEditContent(note.content);
    setEditCodeSnippet(note.codeSnippet || '');
    setEditCodeLanguage(note.codeLanguage || 'typescript');
    setEditTimestamp(note.formattedTimestamp);
    setEditConceptTag(note.conceptTag || '');
    setEditTags(note.tags || []);
    setEditBookmarked(note.isBookmarked);
  };

  const handleSaveEdit = (lessonId: string, noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    onUpdateNote({
      lessonId,
      noteId,
      heading: editHeading.trim(),
      content: trimmed,
      codeSnippet: editCodeSnippet.trim(),
      codeLanguage: editCodeLanguage,
      timestampInput: editTimestamp,
      isBookmarked: editBookmarked,
      conceptTag: editConceptTag,
      tags: editTags,
    });
    setEditingNoteId(null);
    setSaveStatus('saved');
    setLastSavedTimeLabel(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
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
    } catch {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).catch(() => {});
      }
    } catch {}
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
      {/* Header Row: Title + Auto-Save Status Indicator + Export & My Notes Library Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Course-Based Personal Video Notes</span>
            </h3>

            {/* Live Save Status Indicator */}
            <span
              data-testid="note-save-status"
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                saveStatus === 'saving'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : saveStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Auto-saving...</span>
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>Local backup active</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>
                    {saveStatus === 'autosaved' && lastSavedTimeLabel
                      ? `Auto-saved (${lastSavedTimeLabel})`
                      : 'Saved to Course & Lecture'}
                  </span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Connected to <strong>{tracker.title}</strong> →{' '}
            <strong>
              Lecture {currentLessonIndex + 1}: {currentLesson.title}
            </strong>
            . Notes auto-save while you type.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenNotesLibrary && (
            <button
              type="button"
              onClick={onOpenNotesLibrary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Open Centralized My Notes Library across all courses"
            >
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>Open My Notes Library</span>
            </button>
          )}
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

      {/* Rich Lecture Note Composer (Auto-Saves with Debouncing + Supports Headings, Bullets, Tags, Timestamps & Code Snippets) */}
      <form
        onSubmit={handleCreateNoteSubmit}
        className="p-4 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3"
      >
        {/* Row 1: Heading + Timestamp + Concept Tag + Bookmark */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-4">
            <input
              type="text"
              value={noteHeading}
              onChange={e => setNoteHeading(e.target.value)}
              placeholder="Note Heading (e.g. Binary Search Invariant)"
              aria-label="Note heading"
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
            />
          </div>

          {/* Timestamp Input + Quick Capture */}
          <div className="sm:col-span-3 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={timestampInput}
                onChange={e => setTimestampInput(e.target.value)}
                placeholder="MM:SS"
                aria-label="Video timestamp MM:SS"
                className="w-full pl-7 pr-2 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
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
          <div className="sm:col-span-3">
            <input
              type="text"
              value={conceptTag}
              onChange={e => setConceptTag(e.target.value)}
              placeholder="Concept tag"
              aria-label="Concept tag"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
            />
          </div>

          {/* Bookmark Important Concept Toggle */}
          <div className="sm:col-span-2 flex items-center">
            <button
              type="button"
              onClick={() => setIsBookmarked(prev => !prev)}
              aria-pressed={isBookmarked}
              className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isBookmarked
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500 text-amber-600' : ''}`}
              />
              <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Formatting Toolbar + Tag Pills (`Important`, `Revision`, `Exam`, `Formula`, `Interview`, `Code`, `Doubt`) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => handleInsertFormatting('### ')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
              title="Insert section heading"
            >
              <Heading className="w-3 h-3" />
              <span>Heading</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertFormatting('• ')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
              title="Insert bullet point"
            >
              <List className="w-3 h-3" />
              <span>Bullet Point</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertFormatting('**Key Concept:** ')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
              title="Insert bold callout"
            >
              <Bold className="w-3 h-3" />
              <span>Highlight</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCodeEditor(prev => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                showCodeEditor
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>{showCodeEditor ? 'Hide Code Snippet' : '+ Code Snippet'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {NOTE_TAG_PRESETS.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Multi-line Formatted Note Textarea */}
        <div>
          <textarea
            rows={2}
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            placeholder="Write your lecture notes, bullet points, or formulas while watching... (Automatically saves as you type)"
            aria-label="Personal video note content"
            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 leading-relaxed"
          />
        </div>

        {/* Optional Code Snippet Box */}
        {showCodeEditor && (
          <div className="space-y-1.5 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lecture Code Snippet</span>
              </span>
              <select
                value={codeLanguage}
                onChange={e => setCodeLanguage(e.target.value)}
                aria-label="Code snippet language"
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 text-slate-200 border border-slate-700 rounded-md"
              >
                <option value="typescript">TypeScript / JS</option>
                <option value="python">Python</option>
                <option value="cpp">C++ / Java</option>
                <option value="sql">SQL</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={codeSnippet}
              onChange={e => setCodeSnippet(e.target.value)}
              placeholder="// Paste or write code from the lecture here..."
              aria-label="Lecture code snippet"
              className="w-full p-2.5 text-xs font-mono bg-slate-950 text-emerald-300 border border-slate-800 rounded-lg focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            Tip: Notes auto-save in real time. Click <strong>Save Video Note</strong> to lock this note and start a new entry.
          </span>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Video Note</span>
          </button>
        </div>
      </form>

      {/* Search, Scope & Tag Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Interactive Scope Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
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

          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            aria-label="Filter lecture notes by tag"
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
          >
            <option value="all">All Tags</option>
            {NOTE_TAG_PRESETS.map(t => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes, headings, code, or tags..."
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
              Start typing above while watching the video—your note will auto-save and link to this exact lecture.
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
                      value={editHeading}
                      onChange={e => setEditHeading(e.target.value)}
                      placeholder="Heading (optional)"
                      aria-label="Edit note heading"
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
                    />
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
                  </div>
                  <textarea
                    rows={2}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    aria-label="Edit note content"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <textarea
                    rows={2}
                    value={editCodeSnippet}
                    onChange={e => setEditCodeSnippet(e.target.value)}
                    placeholder="Optional code snippet..."
                    aria-label="Edit code snippet"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-900 text-emerald-300 border border-slate-800 rounded-lg"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {NOTE_TAG_PRESETS.map(tag => {
                        const hasTag = editTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setEditTags(prev =>
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              )
                            }
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer ${
                              hasTag
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
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
                </div>
              );
            }

            return (
              <div
                key={note.id}
                className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
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

                    {note.tags &&
                      note.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-md"
                        >
                          #{tag}
                        </span>
                      ))}

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

                  {note.heading && (
                    <h4 className="text-xs font-bold text-slate-900">{note.heading}</h4>
                  )}

                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>

                  {note.codeSnippet && note.codeSnippet.trim() && (
                    <pre className="mt-1.5 p-2.5 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto border border-slate-800">
                      <code>{note.codeSnippet}</code>
                    </pre>
                  )}
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
