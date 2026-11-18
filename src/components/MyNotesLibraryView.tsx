import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Play,
  Pencil,
  Trash2,
  Bookmark,
  Download,
  BookOpen,
  Code2,
  Clock,
  Check,
  X,
  FolderTree,
  ListFilter,
  FileDown,
  Eye,
} from 'lucide-react';
import { Tracker, NoteTag } from '../types';
import {
  EnrichedCourseNote,
  NOTE_TAG_PRESETS,
  getAllNotesAcrossTrackers,
  groupNotesByCourseAndLecture,
  exportMultiCourseNotesToMarkdown,
  buildFormattedRevisionPdfDocument,
} from '../utils/studyWorkspaceLogic';

interface MyNotesLibraryViewProps {
  trackers: Tracker[];
  userId?: string;
  learnerName?: string;
  learnerRole?: string;
  onOpenCourseAndLecture: (trackerId: string, lessonId: string, seekSeconds?: number) => void;
  onUpdateNoteAcrossCourses: (params: {
    trackerId: string;
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
  onDeleteNoteAcrossCourses: (trackerId: string, lessonId: string, noteId: string) => void;
  onToggleBookmarkAcrossCourses: (trackerId: string, lessonId: string, noteId: string) => void;
}

export const MyNotesLibraryView: React.FC<MyNotesLibraryViewProps> = ({
  trackers,
  userId,
  learnerName = 'Alex Rivera',
  learnerRole = 'B.Tech in Computer Science & Engineering',
  onOpenCourseAndLecture,
  onUpdateNoteAcrossCourses,
  onDeleteNoteAcrossCourses,
  onToggleBookmarkAcrossCourses,
}) => {
  // Search, filters & sorting state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedLectureId, setSelectedLectureId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'updated_desc' | 'created_desc' | 'timestamp_asc'>(
    'updated_desc'
  );
  const [displayMode, setDisplayMode] = useState<'hierarchical' | 'recent_list'>('hierarchical');

  // Inline note editing state (mutates the single source of truth)
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editCodeSnippet, setEditCodeSnippet] = useState<string>('');
  const [editCodeLanguage, setEditCodeLanguage] = useState<string>('typescript');
  const [editTimestamp, setEditTimestamp] = useState<string>('00:00');
  const [editConceptTag, setEditConceptTag] = useState<string>('');
  const [editTags, setEditTags] = useState<NoteTag[]>([]);
  const [editBookmarked, setEditBookmarked] = useState<boolean>(false);

  const [exportBanner, setExportBanner] = useState<string | null>(null);

  // Formatted PDF Revision Export Studio state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfDocumentTitle, setPdfDocumentTitle] = useState<string>(
    'Mettleway. Offline Revision Study Guide'
  );
  const [pdfIncludeCodeSnippets, setPdfIncludeCodeSnippets] = useState<boolean>(true);
  const [pdfIncludeToc, setPdfIncludeToc] = useState<boolean>(true);
  const [pdfIncludeCheckboxes, setPdfIncludeCheckboxes] = useState<boolean>(true);
  const [pdfIncludeTimestampsAndTags, setPdfIncludeTimestampsAndTags] = useState<boolean>(true);
  const [pdfTargetCourseId, setPdfTargetCourseId] = useState<string | null>(null);

  // Dynamically available lectures based on selected course
  const availableLectures = useMemo(() => {
    const targetTrackers =
      selectedCourseId === 'all'
        ? trackers
        : trackers.filter(t => t.id === selectedCourseId);
    const list: { id: string; title: string; courseTitle: string; index: number }[] = [];
    for (const t of targetTrackers) {
      let idx = 0;
      for (const mod of t.modules || []) {
        for (const les of mod.lessons || []) {
          list.push({
            id: les.id,
            title: les.title,
            courseTitle: t.title,
            index: idx,
          });
          idx++;
        }
      }
    }
    return list;
  }, [trackers, selectedCourseId]);

  // All matching notes across all courses (Single source of truth)
  const matchingNotes: EnrichedCourseNote[] = useMemo(() => {
    return getAllNotesAcrossTrackers(trackers, {
      userId,
      courseId: selectedCourseId,
      lessonId: selectedLectureId,
      tag: selectedTag,
      onlyBookmarked,
      searchQuery,
      sortBy,
    });
  }, [
    trackers,
    userId,
    selectedCourseId,
    selectedLectureId,
    selectedTag,
    onlyBookmarked,
    searchQuery,
    sortBy,
  ]);

  // Hierarchical grouping: Course -> Lecture -> Personal Notes
  const hierarchicalGroups = useMemo(
    () => groupNotesByCourseAndLecture(trackers, matchingNotes),
    [trackers, matchingNotes]
  );

  // Total unfiltered count for summary metrics
  const totalNotesAcrossAllCourses = useMemo(
    () => getAllNotesAcrossTrackers(trackers, { userId }).length,
    [trackers, userId]
  );

  const coursesWithNotesCount = useMemo(() => {
    const all = getAllNotesAcrossTrackers(trackers, { userId });
    return new Set(all.map(n => n.trackerId)).size;
  }, [trackers, userId]);

  const lecturesWithNotesCount = useMemo(() => {
    const all = getAllNotesAcrossTrackers(trackers, { userId });
    return new Set(all.map(n => `${n.trackerId}::${n.lessonId}`)).size;
  }, [trackers, userId]);

  const handleStartEdit = (note: EnrichedCourseNote) => {
    setEditingNoteKey(`${note.trackerId}::${note.id}`);
    setEditHeading(note.heading || '');
    setEditContent(note.content);
    setEditCodeSnippet(note.codeSnippet || '');
    setEditCodeLanguage(note.codeLanguage || 'typescript');
    setEditTimestamp(note.formattedTimestamp || '00:00');
    setEditConceptTag(note.conceptTag || '');
    setEditTags(note.tags || []);
    setEditBookmarked(Boolean(note.isBookmarked));
  };

  const handleToggleEditTag = (tag: NoteTag) => {
    setEditTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const handleSaveEdit = (note: EnrichedCourseNote) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    onUpdateNoteAcrossCourses({
      trackerId: note.trackerId,
      lessonId: note.lessonId,
      noteId: note.id,
      heading: editHeading.trim(),
      content: trimmed,
      codeSnippet: editCodeSnippet,
      codeLanguage: editCodeLanguage,
      timestampInput: editTimestamp,
      isBookmarked: editBookmarked,
      conceptTag: editConceptTag.trim(),
      tags: editTags,
    });
    setEditingNoteKey(null);
  };

  const handleExportAllMatchingMarkdown = () => {
    const md = exportMultiCourseNotesToMarkdown(trackers, matchingNotes);
    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'devtrack-personal-notes-library.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).catch(() => {});
      }
    } catch {}
    setExportBanner(
      `Exported ${matchingNotes.length} note(s) organized by Course → Lecture as Markdown (.md).`
    );
    setTimeout(() => setExportBanner(null), 3500);
  };

  // Active filter summary string for the PDF revision header
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (pdfTargetCourseId) {
      const course = trackers.find(t => t.id === pdfTargetCourseId);
      if (course) parts.push(`Course: ${course.title}`);
    } else if (selectedCourseId !== 'all') {
      const course = trackers.find(t => t.id === selectedCourseId);
      if (course) parts.push(`Course: ${course.title}`);
    } else {
      parts.push('All Courses');
    }
    if (selectedLectureId !== 'all') {
      const lec = availableLectures.find(l => l.id === selectedLectureId);
      if (lec) parts.push(`Lecture ${lec.index + 1}`);
    }
    if (selectedTag !== 'all') {
      parts.push(`Tag #${selectedTag}`);
    }
    if (onlyBookmarked) {
      parts.push('Bookmarked Only');
    }
    if (searchQuery.trim()) {
      parts.push(`Search "${searchQuery.trim()}"`);
    }
    return parts.join(' · ');
  }, [
    pdfTargetCourseId,
    selectedCourseId,
    selectedLectureId,
    selectedTag,
    onlyBookmarked,
    searchQuery,
    trackers,
    availableLectures,
  ]);

  const notesForPdfPreview = useMemo(() => {
    if (pdfTargetCourseId) {
      return matchingNotes.filter(n => n.trackerId === pdfTargetCourseId);
    }
    return matchingNotes;
  }, [matchingNotes, pdfTargetCourseId]);

  const previewPdfDocument = useMemo(() => {
    return buildFormattedRevisionPdfDocument(trackers, notesForPdfPreview, {
      documentTitle: pdfDocumentTitle,
      learnerName,
      learnerRole,
      includeCodeSnippets: pdfIncludeCodeSnippets,
      includeTableOfContents: pdfIncludeToc,
      includeRevisionCheckboxes: pdfIncludeCheckboxes,
      includeTimestampsAndTags: pdfIncludeTimestampsAndTags,
      filterSummary: activeFilterSummary,
    });
  }, [
    trackers,
    notesForPdfPreview,
    pdfDocumentTitle,
    learnerName,
    learnerRole,
    pdfIncludeCodeSnippets,
    pdfIncludeToc,
    pdfIncludeCheckboxes,
    pdfIncludeTimestampsAndTags,
    activeFilterSummary,
  ]);

  const triggerPdfBinaryDownload = (
    targetNotes: EnrichedCourseNote[],
    customTitle?: string,
    customFilterSummary?: string
  ) => {
    const doc = buildFormattedRevisionPdfDocument(trackers, targetNotes, {
      documentTitle: customTitle || pdfDocumentTitle,
      learnerName,
      learnerRole,
      includeCodeSnippets: pdfIncludeCodeSnippets,
      includeTableOfContents: pdfIncludeToc,
      includeRevisionCheckboxes: pdfIncludeCheckboxes,
      includeTimestampsAndTags: pdfIncludeTimestampsAndTags,
      filterSummary: customFilterSummary || activeFilterSummary,
    });

    try {
      const blob = new Blob([doc.pdfString], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}

    setExportBanner(
      `Exported ${doc.totalNotes} note(s) across ${doc.totalCourses} course(s) (${doc.pages.length} page PDF: ${doc.filename}) for offline revision.`
    );
    setTimeout(() => setExportBanner(null), 4500);
    return doc;
  };

  const handleOpenPdfStudioForAll = () => {
    setPdfTargetCourseId(null);
    setPdfDocumentTitle('Mettleway. Offline Revision Study Guide');
    setIsPdfModalOpen(true);
  };

  const handleOpenPdfStudioForCourse = (courseId: string, courseTitle: string) => {
    setPdfTargetCourseId(courseId);
    setPdfDocumentTitle(`${courseTitle} — Offline Revision Guide`);
    setIsPdfModalOpen(true);
  };

  const renderNoteCard = (note: EnrichedCourseNote, showCourseAndLectureHeader: boolean) => {
    const key = `${note.trackerId}::${note.id}`;
    const isEditing = editingNoteKey === key;

    if (isEditing) {
      return (
        <div
          key={key}
          className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={editHeading}
              onChange={e => setEditHeading(e.target.value)}
              placeholder="Note heading (optional)"
              aria-label="Edit note heading"
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={editTimestamp}
              onChange={e => setEditTimestamp(e.target.value)}
              placeholder="MM:SS"
              aria-label="Edit note timestamp"
              className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={editConceptTag}
              onChange={e => setEditConceptTag(e.target.value)}
              placeholder="Concept tag"
              aria-label="Edit concept tag"
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
            />
          </div>

          <textarea
            rows={3}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            aria-label="Edit note content"
            className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg"
          />

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600">
              Code Snippet (Optional)
            </label>
            <textarea
              rows={2}
              value={editCodeSnippet}
              onChange={e => setEditCodeSnippet(e.target.value)}
              placeholder="Paste or edit code snippet..."
              aria-label="Edit code snippet"
              className="w-full p-2.5 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {NOTE_TAG_PRESETS.map(tag => {
              const active = editTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleEditTag(tag)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border cursor-pointer ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingNoteKey(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveEdit(note)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={key}
        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors space-y-2.5"
      >
        {showCourseAndLectureHeader && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <span className="font-bold text-indigo-700">{note.trackerTitle}</span>
              <span aria-hidden="true">→</span>
              <span className="font-semibold text-slate-800">
                Lecture {note.lessonIndex + 1}: {note.lessonTitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenCourseAndLecture(note.trackerId, note.lessonId, note.timestampSeconds)
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 fill-indigo-700" />
              <span>Open Course &amp; Lecture</span>
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  onOpenCourseAndLecture(note.trackerId, note.lessonId, note.timestampSeconds)
                }
                className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                title="Open lecture and jump to timestamp"
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
                    className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-md"
                  >
                    #{tag}
                  </span>
                ))}

              {note.isBookmarked && (
                <span className="text-amber-700 font-semibold text-[11px]">★ Bookmarked</span>
              )}

              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  Edited {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                </span>
              </span>
            </div>

            {note.heading && (
              <h4 className="text-sm font-bold text-slate-900">{note.heading}</h4>
            )}

            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
              {note.content}
            </div>

            {note.codeSnippet && note.codeSnippet.trim() && (
              <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800">
                <code>{note.codeSnippet}</code>
              </pre>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!showCourseAndLectureHeader && (
              <button
                type="button"
                onClick={() =>
                  onOpenCourseAndLecture(note.trackerId, note.lessonId, note.timestampSeconds)
                }
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer mr-1"
                title="Open original course and lecture"
              >
                Open Lecture
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onToggleBookmarkAcrossCourses(note.trackerId, note.lessonId, note.id)
              }
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                note.isBookmarked
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
              }`}
              aria-label={note.isBookmarked ? 'Remove bookmark' : 'Bookmark note'}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${note.isBookmarked ? 'fill-amber-500' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleStartEdit(note)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label={`Edit note ${note.heading || note.formattedTimestamp}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onDeleteNoteAcrossCourses(note.trackerId, note.lessonId, note.id)
              }
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              aria-label={`Delete note ${note.heading || note.formattedTimestamp}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Summary Metrics */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-600 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              <span>Centralized Personal Notes Library</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {totalNotesAcrossAllCourses} Total Notes across {coursesWithNotesCount} Course(s) &amp;{' '}
              {lecturesWithNotesCount} Lecture(s)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Notes (Course → Lecture → Personal Notes)
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every note you write while watching a video lecture is automatically saved and organized here by its exact course and lecture. Edit any note inline or jump straight back to the video timestamp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDisplayMode('hierarchical')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                displayMode === 'hierarchical'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>Course → Lecture Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('recent_list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                displayMode === 'recent_list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Flat Timeline</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="open-pdf-export-modal-btn"
            onClick={handleOpenPdfStudioForAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF for Offline Revision</span>
          </button>

          <button
            type="button"
            data-testid="quick-export-pdf-btn"
            onClick={() => triggerPdfBinaryDownload(matchingNotes)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
            title="Immediately download a formatted A4 PDF of all currently filtered notes"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Quick PDF (.pdf)</span>
          </button>

          <button
            type="button"
            data-testid="export-notes-md-btn"
            onClick={handleExportAllMatchingMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (.md)</span>
          </button>
        </div>
      </div>

      {exportBanner && (
        <div
          role="status"
          data-testid="notes-export-status-banner"
          className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between"
        >
          <span>{exportBanner}</span>
          <button
            type="button"
            onClick={() => setExportBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Dismiss export status"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Course Filter, Lecture Filter, Tag Filter & Sort Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input (4 cols) */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search headings, notes, code snippets, or courses..."
              aria-label="Search all personal notes"
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
            />
          </div>

          {/* Course Filter Dropdown (3 cols) */}
          <div className="md:col-span-3">
            <select
              value={selectedCourseId}
              onChange={e => {
                setSelectedCourseId(e.target.value);
                setSelectedLectureId('all');
              }}
              aria-label="Filter notes by course"
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 cursor-pointer"
            >
              <option value="all">All Courses ({trackers.length})</option>
              {trackers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Lecture Filter Dropdown (3 cols) */}
          <div className="md:col-span-3">
            <select
              value={selectedLectureId}
              onChange={e => setSelectedLectureId(e.target.value)}
              aria-label="Filter notes by lecture"
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 cursor-pointer"
            >
              <option value="all">All Lectures ({availableLectures.length})</option>
              {availableLectures.map(lec => (
                <option key={`${lec.courseTitle}-${lec.id}`} value={lec.id}>
                  Lec {lec.index + 1}: {lec.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Date / Timestamp (2 cols) */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={e =>
                setSortBy(
                  e.target.value as 'updated_desc' | 'created_desc' | 'timestamp_asc'
                )
              }
              aria-label="Sort notes by"
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 cursor-pointer"
            >
              <option value="updated_desc">Recently Edited</option>
              <option value="created_desc">Recently Created</option>
              <option value="timestamp_asc">Video Timestamp</option>
            </select>
          </div>
        </div>

        {/* Tag Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Tag Filter:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedTag === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tags
            </button>
            {NOTE_TAG_PRESETS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyBookmarked(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              onlyBookmarked
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${onlyBookmarked ? 'fill-amber-500 text-amber-600' : ''}`}
            />
            <span>Bookmarked Only</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Hierarchical Course -> Lecture -> Notes OR Flat Timeline */}
      {matchingNotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Personal Notes Match Your Current Filters
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Open any course lecture in Today&apos;s Tasks to write timestamped notes, formulas, and code snippets—or clear your search filters above.
          </p>
        </div>
      ) : displayMode === 'hierarchical' ? (
        <div className="space-y-6">
          {hierarchicalGroups.map(courseGroup => (
            <div
              key={courseGroup.courseId}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5"
            >
              {/* Course Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
                    <span>{courseGroup.courseCategory}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {courseGroup.totalNotesCount} note(s) across {courseGroup.lectures.length}{' '}
                      lecture(s)
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    Course: {courseGroup.courseTitle}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    data-testid={`export-course-pdf-${courseGroup.courseId}`}
                    onClick={() =>
                      handleOpenPdfStudioForCourse(courseGroup.courseId, courseGroup.courseTitle)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Export Course PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenCourseAndLecture(
                        courseGroup.courseId,
                        courseGroup.lectures[0]?.lessonId || '',
                        0
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-indigo-700" />
                    <span>Open Course Player</span>
                  </button>
                </div>
              </div>

              {/* Lectures inside this Course */}
              <div className="space-y-5">
                {courseGroup.lectures.map(lectureGroup => (
                  <div
                    key={lectureGroup.lessonId}
                    className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {lectureGroup.moduleTitle} · Lecture {lectureGroup.lessonIndex + 1}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {lectureGroup.lessonTitle}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenCourseAndLecture(
                            courseGroup.courseId,
                            lectureGroup.lessonId,
                            lectureGroup.notes[0]?.timestampSeconds || 0
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Open Course &amp; Lecture</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {lectureGroup.notes.map(note => renderNoteCard(note, false))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {matchingNotes.map(note => renderNoteCard(note, true))}
        </div>
      )}

      {/* Offline Revision Formatted PDF Studio & Preview Modal */}
      {isPdfModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export Notes to Formatted PDF for Offline Revision"
          data-testid="pdf-revision-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                  <FileDown className="w-4 h-4" />
                  <span>Offline Revision PDF Studio</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {previewPdfDocument.pages.length} Page(s) · {previewPdfDocument.totalNotes}{' '}
                    Note(s) across {previewPdfDocument.totalCourses} Course(s)
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Export Formatted PDF Study Guide for Offline Revision
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                aria-label="Close PDF export studio"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Left Configuration + Right Formatted A4 Sheet Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Column: Formatting & Scope Controls (5 cols) */}
              <div className="lg:col-span-5 p-6 space-y-5 bg-white">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pdf-doc-title-input"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Revision Document Title
                  </label>
                  <input
                    id="pdf-doc-title-input"
                    data-testid="pdf-doc-title-input"
                    type="text"
                    value={pdfDocumentTitle}
                    onChange={e => setPdfDocumentTitle(e.target.value)}
                    placeholder="e.g. Mettleway. Offline Revision Study Guide"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pdf-course-scope-select"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Course Scope for PDF Booklet
                  </label>
                  <select
                    id="pdf-course-scope-select"
                    data-testid="pdf-course-scope-select"
                    value={pdfTargetCourseId || 'all_matching'}
                    onChange={e =>
                      setPdfTargetCourseId(
                        e.target.value === 'all_matching' ? null : e.target.value
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="all_matching">
                      All Currently Filtered Notes ({matchingNotes.length} notes)
                    </option>
                    {trackers.map(t => (
                      <option key={t.id} value={t.id}>
                        Only Course: {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <span className="block text-xs font-bold text-slate-700">
                    Offline Revision Formatting Options
                  </span>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="pdf-toggle-toc"
                      checked={pdfIncludeToc}
                      onChange={e => setPdfIncludeToc(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Include Course → Lecture Table of Contents
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Adds an indexed syllabus summary at the top of Page 1
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="pdf-toggle-code"
                      checked={pdfIncludeCodeSnippets}
                      onChange={e => setPdfIncludeCodeSnippets(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Include Monospace Code Snippets
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Formats attached code blocks in Courier monospace boxes
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="pdf-toggle-checkboxes"
                      checked={pdfIncludeCheckboxes}
                      onChange={e => setPdfIncludeCheckboxes(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Include Self-Test Revision Checkboxes ([ ])
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Adds print-friendly check-off boxes next to every note heading
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="pdf-toggle-timestamps"
                      checked={pdfIncludeTimestampsAndTags}
                      onChange={e => setPdfIncludeTimestampsAndTags(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Include Video Timestamps, Bookmarks &amp; Tags
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Displays lecture timestamp [MM:SS] and #Important/#Exam tags
                      </p>
                    </div>
                  </label>
                </div>

                {/* Output File Metadata Card */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-indigo-950">
                    <span>Output File:</span>
                    <span className="font-mono text-[11px] text-indigo-700">
                      {previewPdfDocument.filename}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Format &amp; Page Size:</span>
                    <span className="font-mono tabular-nums">
                      A4 PDF ({previewPdfDocument.pages.length} Page
                      {previewPdfDocument.pages.length === 1 ? '' : 's'} ·{' '}
                      {(previewPdfDocument.pdfBytes.byteLength / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Formatted Revision Sheet Preview (7 cols) */}
              <div className="lg:col-span-7 p-6 bg-slate-100/80 space-y-4 overflow-y-auto max-h-[62vh]">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Live Formatted Revision Sheet Preview</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px]">
                    {previewPdfDocument.totalCourses} Course(s) · {previewPdfDocument.totalLectures}{' '}
                    Lecture(s) · {previewPdfDocument.totalNotes} Note(s)
                  </span>
                </div>

                {/* Simulated A4 Revision Document Sheet */}
                <div
                  data-testid="pdf-preview-sheet"
                  className="bg-white border border-slate-300 rounded-xl shadow-sm p-6 space-y-5 text-slate-900"
                >
                  {/* Top Indigo Accent Bar & Title */}
                  <div className="border-t-4 border-indigo-600 pt-4 pb-3 border-b border-slate-200 space-y-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {previewPdfDocument.title}
                    </h3>
                    <p className="text-xs text-slate-600">{previewPdfDocument.subtitle}</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Scope: {activeFilterSummary} · Generated{' '}
                      {previewPdfDocument.exportedAtIso.slice(0, 10)}
                    </p>
                  </div>

                  {/* Table of Contents Preview */}
                  {pdfIncludeToc && previewPdfDocument.tableOfContents.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                        Revision Table of Contents (Course → Lecture Overview)
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {previewPdfDocument.tableOfContents.map((toc, i) => (
                          <li key={toc.courseTitle} className="flex items-center justify-between">
                            <span>
                              {i + 1}. <strong>{toc.courseTitle}</strong> ({toc.courseCategory})
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {toc.lectureCount} lecture(s) · {toc.noteCount} note(s)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hierarchical Course -> Lecture -> Notes Preview */}
                  {previewPdfDocument.courses.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">
                      No matching notes in current selection.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {previewPdfDocument.courses.map((course, cIdx) => (
                        <div key={course.courseId} className="space-y-3">
                          <div className="px-3 py-1.5 bg-indigo-50 border-l-4 border-indigo-600 rounded-r-lg">
                            <p className="text-xs font-bold text-indigo-950 uppercase">
                              Course {cIdx + 1}: {course.courseTitle} ({course.courseCategory})
                            </p>
                          </div>

                          {course.lectures.map(lec => (
                            <div key={lec.lessonId} className="pl-3 space-y-2">
                              <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                                Lecture {lec.lessonIndex + 1}: {lec.lessonTitle}{' '}
                                <span className="font-normal text-slate-500">
                                  [{lec.moduleTitle}]
                                </span>
                              </p>

                              <div className="space-y-2.5 pl-2">
                                {lec.notes.map((n, nIdx) => (
                                  <div
                                    key={n.id}
                                    className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg space-y-1"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-slate-900">
                                        {pdfIncludeCheckboxes ? '☐ ' : ''}
                                        {n.heading || `Revision Note #${nIdx + 1}`}
                                      </p>
                                      {pdfIncludeTimestampsAndTags && (
                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-600">
                                          <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-indigo-700">
                                            [{n.formattedTimestamp}]
                                          </span>
                                          {n.isBookmarked && (
                                            <span className="text-amber-700 font-bold">
                                              ★ BOOKMARKED
                                            </span>
                                          )}
                                          {n.tags?.map(t => (
                                            <span
                                              key={t}
                                              className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded"
                                            >
                                              #{t}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                      {n.content}
                                    </p>

                                    {pdfIncludeCodeSnippets &&
                                      n.codeSnippet &&
                                      n.codeSnippet.trim() && (
                                        <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto">
                                          <code>{n.codeSnippet}</code>
                                        </pre>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Generates a standards-compliant A4 PDF file (<code className="font-mono">%PDF-1.4</code>) ready for offline study and printing.
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="confirm-download-pdf-btn"
                  onClick={() => {
                    triggerPdfBinaryDownload(notesForPdfPreview);
                    setIsPdfModalOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    Download Formatted PDF ({previewPdfDocument.pages.length} Page
                    {previewPdfDocument.pages.length === 1 ? '' : 's'})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
