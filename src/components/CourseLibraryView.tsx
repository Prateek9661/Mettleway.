import React, { useState, useMemo } from 'react';
import {
  Search,
  Heart,
  Bookmark,
  Play,
  Map,
  Trash2,
  Plus,
  Filter,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  FolderKanban,
  AlertTriangle,
} from 'lucide-react';
import { Tracker, CourseSortOption } from '../types';
import {
  filterAndSortTrackers,
  inferCourseTechnologies,
  categorizeCourseDifficulty,
  calculateCourseProgress,
  getContinueLearningInfoForTracker,
  getCourseThemeTokens,
} from '../utils/studyWorkspaceLogic';

interface CourseLibraryViewProps {
  trackers: Tracker[];
  activeTrackerId: string;
  onSelectAndResumeCourse: (trackerId: string, lessonId?: string) => void;
  onOpenSyllabus: (trackerId: string) => void;
  onToggleFavorite: (trackerId: string) => void;
  onToggleBookmark: (trackerId: string) => void;
  onRecategorizeCourse: (trackerId: string, newCategory: string) => void;
  onDeleteCourse: (trackerId: string) => void;
  onDeleteAllLearningData: () => void;
  onOpenCreateModal: () => void;
}

const STANDARD_CATEGORIES = [
  'DSA',
  'Web Development',
  'DBMS & SQL',
  'Operating Systems',
  'Computer Networks',
  'AI & ML',
  'System Design',
  'Object-Oriented Programming',
  'Software Engineering',
];

export const CourseLibraryView: React.FC<CourseLibraryViewProps> = ({
  trackers,
  activeTrackerId,
  onSelectAndResumeCourse,
  onOpenSyllabus,
  onToggleFavorite,
  onToggleBookmark,
  onRecategorizeCourse,
  onDeleteCourse,
  onDeleteAllLearningData,
  onOpenCreateModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTechnology, setSelectedTechnology] = useState<string>('all');
  const [sortBy, setSortBy] = useState<CourseSortOption>('recently_added');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);

  // Extract distinct subjects/categories present in trackers + standard catalog
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    trackers.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [trackers]);

  // Extract distinct technologies present across all saved courses
  const availableTechnologies = useMemo(() => {
    const set = new Set<string>();
    trackers.forEach(t => {
      inferCourseTechnologies(t).forEach(tech => set.add(tech));
    });
    return Array.from(set).sort();
  }, [trackers]);

  const filteredTrackers = useMemo(
    () =>
      filterAndSortTrackers(trackers, {
        searchQuery,
        category: selectedCategory,
        difficulty: selectedDifficulty,
        technology: selectedTechnology,
        sortBy,
        onlyFavorites,
        onlyBookmarked,
      }),
    [
      trackers,
      searchQuery,
      selectedCategory,
      selectedDifficulty,
      selectedTechnology,
      sortBy,
      onlyFavorites,
      onlyBookmarked,
    ]
  );

  const favoritesCount = useMemo(() => trackers.filter(t => t.isFavorite).length, [trackers]);
  const bookmarkedCount = useMemo(() => trackers.filter(t => t.isBookmarked).length, [trackers]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSelectedTechnology('all');
    setSortBy('recently_added');
    setOnlyFavorites(false);
    setOnlyBookmarked(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-600">Advanced Course Library</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{trackers.length} Saved Courses</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{favoritesCount} Favorites</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{bookmarkedCount} Bookmarked</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Course Library &amp; Curriculum Catalog
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Search your saved courses, filter by subject, difficulty, and technology, sort by completion or title, and organize favorites and bookmarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Import New Course</span>
          </button>
        </div>
      </div>

      {/* Filter, Search & Sort Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input (4 cols) */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search courses by title, topic, instructor, or lesson..."
              aria-label="Search saved courses"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
            />
          </div>

          {/* Subject / Category Filter (2 cols) */}
          <div className="md:col-span-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Filter by subject"
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter (2 cols) */}
          <div className="md:col-span-2">
            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value)}
              aria-label="Filter by difficulty"
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          {/* Technology Filter (2 cols) */}
          <div className="md:col-span-2">
            <select
              value={selectedTechnology}
              onChange={e => setSelectedTechnology(e.target.value)}
              aria-label="Filter by technology"
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Technologies</option>
              {availableTechnologies.map(tech => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Selector (2 cols) */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden lg:inline" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as CourseSortOption)}
              aria-label="Sort courses by"
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="recently_added">Sort: Recently Added</option>
              <option value="completion">Sort: Completion %</option>
              <option value="title">Sort: Title (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Bar: Favorites, Bookmarks, Active Count & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Quick Filters:</span>
            </span>

            <button
              type="button"
              onClick={() => setOnlyFavorites(prev => !prev)}
              aria-pressed={onlyFavorites}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                onlyFavorites
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>Favorites ({favoritesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyBookmarked(prev => !prev)}
              aria-pressed={onlyBookmarked}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                onlyBookmarked
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${onlyBookmarked ? 'fill-amber-500 text-amber-600' : ''}`}
              />
              <span>Bookmarked ({bookmarkedCount})</span>
            </button>

            {(searchQuery ||
              selectedCategory !== 'all' ||
              selectedDifficulty !== 'all' ||
              selectedTechnology !== 'all' ||
              onlyFavorites ||
              onlyBookmarked) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          <span className="font-mono tabular-nums text-slate-600 font-semibold">
            Showing {filteredTrackers.length} of {trackers.length} courses
          </span>
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredTrackers.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-base font-bold text-slate-900">
            No courses match your current filters
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try clearing your search or filter criteria, or import a new YouTube playlist into your learning library.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Reset All Filters
            </button>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
            >
              Import New Course
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTrackers.map(tracker => {
            const progress = calculateCourseProgress(tracker);
            const continueInfo = getContinueLearningInfoForTracker(tracker);
            const techs = inferCourseTechnologies(tracker);
            const normalizedDiff = categorizeCourseDifficulty(tracker.difficulty);
            const theme = getCourseThemeTokens(tracker.category);
            const isCurrentActive = tracker.id === activeTrackerId;
            const pendingCount = Math.max(0, progress.total - progress.completed);

            return (
              <div
                key={tracker.id}
                className={`bg-white border rounded-2xl p-6 transition-all flex flex-col justify-between gap-5 ${
                  isCurrentActive
                    ? 'border-indigo-300 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Metadata & Favorite / Bookmark Controls */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className={`font-semibold ${theme.accentText}`}>
                        {tracker.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{normalizedDiff}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tracker.instructor}</span>
                      {isCurrentActive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-indigo-600">Active Course</span>
                        </>
                      )}
                    </div>

                    {/* Favorite, Bookmark & Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(tracker.id)}
                        aria-pressed={Boolean(tracker.isFavorite)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          tracker.isFavorite
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                        }`}
                        title={tracker.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                        aria-label={
                          tracker.isFavorite
                            ? `Remove ${tracker.title} from Favorites`
                            : `Favorite ${tracker.title}`
                        }
                      >
                        <Heart
                          className={`w-4 h-4 ${tracker.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleBookmark(tracker.id)}
                        aria-pressed={Boolean(tracker.isBookmarked)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          tracker.isBookmarked
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-slate-400 hover:text-amber-700 hover:bg-slate-100'
                        }`}
                        title={tracker.isBookmarked ? 'Remove Bookmark' : 'Bookmark Course'}
                        aria-label={
                          tracker.isBookmarked
                            ? `Remove bookmark for ${tracker.title}`
                            : `Bookmark ${tracker.title}`
                        }
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            tracker.isBookmarked ? 'fill-amber-500 text-amber-600' : ''
                          }`}
                        />
                      </button>

                      {trackers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteCourse(tracker.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete saved course"
                          aria-label={`Delete course ${tracker.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Course Title & Description */}
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-snug">
                      {tracker.title}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {tracker.description}
                    </p>
                  </div>

                  {/* Technology & Subject Categorization Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Tech:</span>
                      <span>{techs.join(' · ')}</span>
                    </div>

                    {/* Categorize Course Selector */}
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={tracker.category}
                        onChange={e => onRecategorizeCourse(tracker.id, e.target.value)}
                        aria-label={`Categorize ${tracker.title}`}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        {Array.from(new Set([...STANDARD_CATEGORIES, tracker.category])).map(cat => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Progress Bar + Last Watched Info + Action Buttons */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        {progress.completed} completed · {pendingCount} pending
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {progress.completed}/{progress.total} lectures ({progress.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${theme.progressBg} rounded-full transition-all duration-300`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  {continueInfo && (
                    <p className="text-xs text-slate-600 truncate">
                      {progress.percent >= 100 ? (
                        <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Course 100% Completed</span>
                        </span>
                      ) : (
                        <>
                          Resume Lecture {continueInfo.lessonIndex + 1}:{' '}
                          <strong className="text-slate-800">{continueInfo.lessonTitle}</strong>
                        </>
                      )}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectAndResumeCourse(tracker.id, continueInfo?.lessonId)
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>
                          {progress.completed > 0 ? 'Continue Learning' : 'Start Course'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenSyllabus(tracker.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Map className="w-3.5 h-3.5 text-slate-500" />
                        <span>Full Syllabus</span>
                      </button>
                    </div>

                    {tracker.sourceUrl && /^https?:\/\//i.test(tracker.sourceUrl) && (
                      <a
                        href={tracker.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Source Playlist</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Data Privacy & Delete Saved Learning Data Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">
            Account Data Isolation &amp; Saved Learning Data Management
          </h3>
          <p className="text-xs text-slate-500">
            Your courses, lesson progress, and timestamped notes are isolated to your learner profile. You can permanently delete and reset your saved learning data at any time.
          </p>
        </div>

        {!confirmDeleteAll ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteAll(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Saved Learning Data</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-rose-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Confirm permanent deletion?</span>
            </span>
            <button
              type="button"
              onClick={() => {
                onDeleteAllLearningData();
                setConfirmDeleteAll(false);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              Yes, Delete All Data
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
