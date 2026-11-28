import React from 'react';
import {
  Search,
  Youtube,
  Loader2,
  CalendarClock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { Tracker, PlaylistDiscoveryResult } from '../types';
import {
  YouTubePlaylistSearchItem,
  YouTubeCourseSearchResponse,
  searchCuratedYouTubePlaylists,
  discoverYouTubePlaylist,
  buildTrackerFromVerifiedLessons,
} from '../utils/youtubePlaylistDiscovery';
import { buildDynamicTrackerFromInput } from '../utils/studyWorkspaceLogic';

export const QUICK_COURSE_SEARCH_TOPICS = [
  'Python Full Course',
  'React JS',
  'DSA',
  'DBMS',
  'System Design',
  'Operating Systems',
  'Machine Learning',
  'Docker DevOps',
];

/**
 * Calls server-side `/api/youtube/search` (which uses YouTube Data API v3 + curated fallback),
 * with a client-side curated fallback if the network request itself fails.
 */
export async function fetchYouTubeCourseSearch(
  query: string
): Promise<YouTubeCourseSearchResponse> {
  const cleanQuery = String(query || '').trim().slice(0, 120);
  try {
    const res = await fetch(
      `/api/youtube/search?q=${encodeURIComponent(cleanQuery)}`
    );
    if (res.ok) {
      const payload = await res.json();
      if (payload && Array.isArray(payload.results)) {
        return {
          query: cleanQuery,
          source:
            payload.source === 'youtube_api' ? 'youtube_api' : 'curated_fallback',
          notice: typeof payload.notice === 'string' ? payload.notice : undefined,
          results: payload.results as YouTubePlaylistSearchItem[],
        };
      }
    }
  } catch {
    // Fall back cleanly to curated local catalog
  }

  return {
    query: cleanQuery,
    source: 'curated_fallback',
    notice: 'Showing Mettleway. curated playlists ready for instant enrollment.',
    results: searchCuratedYouTubePlaylists(cleanQuery, 8),
  };
}

/**
 * Imports a discovered YouTube playlist into a full Mettleway. course roadmap Tracker
 * so the learner can immediately lock their daily class schedule.
 */
export async function enrollSearchedPlaylistToTracker(
  playlist: YouTubePlaylistSearchItem,
  options?: {
    dailyMinutes?: number;
    scheduledTime?: string;
    studyDays?: number[];
  }
): Promise<Tracker> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(
    playlist.playlistId
  )}`;
  const dailyMinutes = options?.dailyMinutes ?? 60;
  const scheduledTime = options?.scheduledTime ?? '16:00';
  const studyDays =
    options?.studyDays && options.studyDays.length > 0
      ? options.studyDays
      : [1, 2, 3, 4, 5, 6];
  const trackerId = `tracker-${Date.now()}`;

  let discovery: PlaylistDiscoveryResult | null = null;
  try {
    const res = await fetch('/api/youtube/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: playlistUrl,
        selectedPlaylistId: playlist.playlistId,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (payload?.data) {
      discovery = payload.data as PlaylistDiscoveryResult;
    }
  } catch {
    // Fallback to local discovery
  }

  if (!discovery) {
    try {
      discovery = await discoverYouTubePlaylist({
        inputUrl: playlistUrl,
        selectedPlaylistId: playlist.playlistId,
      });
    } catch {
      discovery = null;
    }
  }

  if (
    discovery &&
    (discovery.status === 'playlist_found' ||
      discovery.status === 'multiple_playlists_found') &&
    discovery.selectedPlaylist &&
    discovery.selectedPlaylist.lessons.length >= 2
  ) {
    return buildTrackerFromVerifiedLessons({
      lessons: discovery.selectedPlaylist.lessons,
      playlistId: playlist.playlistId,
      courseTitle: playlist.title || discovery.selectedPlaylist.title,
      instructor: playlist.channelTitle || discovery.selectedPlaylist.channelTitle,
      category: playlist.category || discovery.videoMetadata?.category,
      sourceUrl: playlistUrl,
      dailyMinutes,
      scheduledTime,
      studyDays,
      trackerId,
    });
  }

  // Fallback if a live external YouTube playlist had restricted scraping:
  // still create a structured Mettleway. course roadmap seeded with its real metadata
  return buildDynamicTrackerFromInput({
    inputUrl: playlistUrl,
    rawTopic: playlist.title,
    extractedData: {
      title: playlist.title,
      instructor: playlist.channelTitle,
      category: playlist.category,
    },
    dailyMinutes,
    scheduledTime,
    studyDays,
    trackerId,
  });
}

interface YouTubeCourseSearchResultsProps {
  results: YouTubePlaylistSearchItem[];
  isLoading: boolean;
  enrollingPlaylistId: string | null;
  query: string;
  source?: 'youtube_api' | 'curated_fallback';
  notice?: string;
  onEnrollPlaylist: (playlist: YouTubePlaylistSearchItem) => void;
  columns?: 2 | 3;
}

export const YouTubeCourseSearchResults: React.FC<
  YouTubeCourseSearchResultsProps
> = ({
  results,
  isLoading,
  enrollingPlaylistId,
  query,
  source = 'curated_fallback',
  notice,
  onEnrollPlaylist,
  columns = 2,
}) => {
  const gridColsClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2';

  if (isLoading) {
    return (
      <div
        data-testid="course-search-loading"
        className={`grid ${gridColsClass} gap-3.5`}
      >
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden animate-pulse"
          >
            <div className="aspect-video bg-zinc-800" />
            <div className="p-3.5 space-y-2.5">
              <div className="h-3.5 bg-zinc-800 rounded w-5/6" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
              <div className="h-8 bg-zinc-800 rounded-lg w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        data-testid="course-search-empty"
        className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center space-y-2"
      >
        <Search className="w-7 h-7 text-amber-400 mx-auto opacity-80" />
        <p className="text-sm font-bold text-zinc-100">
          No playlists found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-xs text-zinc-400">
          Try searching a broader topic like &ldquo;Python Full Course&rdquo;, &ldquo;React JS&rdquo;, or &ldquo;DSA&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="course-search-results-grid">
      {/* Subtle status row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {query
              ? `${results.length} YouTube courses for "${query}"`
              : `Top ${results.length} Recommended YouTube Courses`}
          </span>
        </span>
        <span className="text-zinc-400">
          {source === 'youtube_api'
            ? 'Live YouTube Data API v3'
            : notice || 'Mettleway. Curated Catalog'}
        </span>
      </div>

      {/* Obsidian Dark Playlist Cards */}
      <div className={`grid ${gridColsClass} gap-3.5`}>
        {results.map(playlist => {
          const isEnrolling = enrollingPlaylistId === playlist.playlistId;
          const isAnyEnrolling = Boolean(enrollingPlaylistId);

          return (
            <div
              key={playlist.playlistId}
              data-testid="course-search-result-card"
              className="group rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 overflow-hidden flex flex-col transition-all shadow-md"
            >
              {/* 16:9 Playlist Thumbnail */}
              <div className="relative aspect-video bg-zinc-950 overflow-hidden border-b border-zinc-800">
                <img
                  src={playlist.thumbnail}
                  alt={playlist.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute bottom-2 right-2 bg-zinc-950/90 border border-zinc-700/80 text-zinc-100 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Youtube className="w-3 h-3 text-amber-400" />
                  <span>
                    {playlist.lessonCountHint
                      ? `${playlist.lessonCountHint} Lectures`
                      : 'Playlist'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-2 leading-snug">
                    {playlist.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate font-medium text-zinc-300">
                      {playlist.channelTitle}
                    </span>
                    {playlist.category && (
                      <>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-400 truncate">
                          {playlist.category}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Forge Amber Primary Action */}
                <button
                  type="button"
                  data-testid="enroll-playlist-btn"
                  disabled={isAnyEnrolling}
                  onClick={() => onEnrollPlaylist(playlist)}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing Playlist...</span>
                    </>
                  ) : (
                    <>
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Enroll &amp; Set Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
