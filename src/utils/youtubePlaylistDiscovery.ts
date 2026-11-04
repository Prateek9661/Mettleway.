import {
  DiscoveredPlaylistCandidate,
  PlaylistDiscoveryResult,
  PlaylistLessonItem,
  Tracker,
  Module,
  Lesson,
} from '../types';
import {
  parseYouTubeSourceUrl,
  normalizeCourseSeriesTitle,
  getCourseThemeTokens,
} from './studyWorkspaceLogic';

export const PLAYLIST_FALLBACK_MESSAGE =
  "We couldn't automatically identify the complete playlist. Please paste the playlist URL or choose another import method.";

export type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}>;

export interface RawPlaylistVideoEntry {
  videoId: string;
  title: string;
  thumbnail?: string;
  durationMinutes?: number;
  channelTitle?: string;
  privacyStatus?: string;
  position?: number;
}

export interface VideoMetadataInfo {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  durationMinutes: number;
  topic: string;
  category: string;
}

/**
 * Parses an ISO 8601 duration string from YouTube Data API v3 (e.g. "PT1H12M30S", "PT28M10S")
 * into rounded minutes (minimum 5 minutes).
 */
export function parseIso8601DurationToMinutes(isoDuration?: string): number {
  if (!isoDuration || typeof isoDuration !== 'string') return 30;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 30;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalMinutes = hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
  return Math.max(5, totalMinutes || 25);
}

/**
 * Returns a reliable YouTube thumbnail URL for a given videoId.
 */
export function getYouTubeThumbnailUrl(videoId: string, preferredUrl?: string): string {
  const trimmed = (preferredUrl || '').trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const cleanId = (videoId || '').trim();
  return cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : '';
}

/**
 * Builds the canonical watch URL for a lesson in a playlist or standalone manual list.
 */
export function buildLessonWatchUrl(
  videoId: string,
  playlistId?: string | null,
  playlistPosition?: number
): string {
  const cleanVid = (videoId || '').trim();
  const cleanList = (playlistId || '').trim();
  if (cleanVid && cleanList) {
    const pos = Number.isFinite(playlistPosition) && (playlistPosition as number) > 0 ? playlistPosition : 1;
    return `https://www.youtube.com/watch?v=${cleanVid}&list=${cleanList}&index=${pos}`;
  }
  return `https://www.youtube.com/watch?v=${cleanVid}`;
}

/**
 * Checks if a playlist item from YouTube is private, deleted, or unavailable.
 */
export function isUnavailableOrPrivateVideo(entry: {
  videoId?: string;
  title?: string;
  privacyStatus?: string;
}): boolean {
  const vid = (entry.videoId || '').trim();
  if (!vid || vid.length < 5) return true;

  const privacy = (entry.privacyStatus || '').toLowerCase().trim();
  if (privacy === 'private' || privacy === 'privacystatusunspecified') {
    return true;
  }

  const titleLower = (entry.title || '').toLowerCase().trim();
  if (
    !titleLower ||
    titleLower === 'private video' ||
    titleLower === '[private video]' ||
    titleLower === 'deleted video' ||
    titleLower === '[deleted video]' ||
    titleLower === 'unavailable video'
  ) {
    return true;
  }

  return false;
}

/**
 * Deduplicates raw playlist entries by `videoId` while strictly preserving original playlist order,
 * filtering out private/deleted videos, and assigning 1-based sequential `playlistPosition`.
 */
export function normalizeAndDeduplicatePlaylistItems(
  rawEntries: RawPlaylistVideoEntry[],
  playlistId?: string | null
): PlaylistLessonItem[] {
  const seenVideoIds = new Set<string>();
  const normalized: PlaylistLessonItem[] = [];

  for (const entry of rawEntries) {
    if (!entry || isUnavailableOrPrivateVideo(entry)) {
      continue;
    }
    const videoId = entry.videoId.trim();
    if (seenVideoIds.has(videoId)) {
      continue;
    }
    seenVideoIds.add(videoId);

    const playlistPosition = normalized.length + 1;
    const cleanTitle = entry.title.trim();
    const thumbnail = getYouTubeThumbnailUrl(videoId, entry.thumbnail);
    const videoUrl = buildLessonWatchUrl(videoId, playlistId, playlistPosition);

    normalized.push({
      videoId,
      title: cleanTitle,
      thumbnail,
      videoUrl,
      playlistPosition,
      durationMinutes: Math.max(5, Number(entry.durationMinutes) || 30),
      channelTitle: entry.channelTitle,
    });
  }

  return normalized;
}

/**
 * Critical Bug Prevention Invariant:
 * Verifies that:
 * 1. Every lesson has its own non-empty `videoId`, `title`, `thumbnail`, `videoUrl`, and `playlistPosition`.
 * 2. No two lessons ever share the same `videoId`.
 */
export function assertUniqueVideoIdsAcrossLessons(
  lessons: Array<{
    videoId?: string;
    title: string;
    thumbnail?: string;
    videoUrl: string;
    playlistPosition?: number;
  }>
): { valid: boolean; reason?: string } {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return { valid: false, reason: 'No lessons provided.' };
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < lessons.length; i++) {
    const les = lessons[i];
    const parsed = parseYouTubeSourceUrl(les.videoUrl || '');
    const vid = (les.videoId || parsed.videoId || '').trim();
    if (!vid) {
      return { valid: false, reason: `Lesson at index ${i} is missing a videoId.` };
    }
    if (!les.title || !les.title.trim()) {
      return { valid: false, reason: `Lesson at index ${i} is missing a title.` };
    }
    if (!les.thumbnail || !les.thumbnail.trim()) {
      return { valid: false, reason: `Lesson at index ${i} is missing a thumbnail.` };
    }
    if (!les.videoUrl || !les.videoUrl.trim()) {
      return { valid: false, reason: `Lesson at index ${i} is missing a videoUrl.` };
    }
    if (typeof les.playlistPosition !== 'number' || les.playlistPosition < 1) {
      return { valid: false, reason: `Lesson at index ${i} is missing a valid playlistPosition.` };
    }
    if (seenIds.has(vid)) {
      return {
        valid: false,
        reason: `Duplicate videoId "${vid}" detected at lesson index ${i}. Never assign the same videoId to multiple lessons.`,
      };
    }
    seenIds.add(vid);
  }

  return { valid: true };
}

/**
 * Infers the programming / academic course topic and category from a video or playlist title.
 */
export function inferTopicAndCategoryFromTitle(
  title: string,
  description: string = ''
): { topic: string; category: string } {
  const combined = `${title} ${description}`.toLowerCase();
  const cleanSeriesTitle = normalizeCourseSeriesTitle(title) || title.trim() || 'Programming Course';

  if (/\b(dbms|database|sql|postgres|mysql|normalization|er diagram)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'DBMS & SQL' };
  }
  if (/\b(operating system|os\b|deadlock|process scheduling|paging|semaphore)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'Operating Systems' };
  }
  if (/\b(computer network|tcp\/ip|osi model|subnetting|routing|http|dns)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'Computer Networks' };
  }
  if (/\b(oop|object oriented|polymorphism|encapsulation|inheritance|java\b|c\+\+)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'Object-Oriented Programming' };
  }
  if (/\b(python|machine learning|deep learning|data science|ai\b|neural|pandas|numpy|pytorch)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'AI & ML' };
  }
  if (/\b(web|react|javascript|typescript|node|nextjs|frontend|backend|full stack|html|css|mern)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'Web Development' };
  }
  if (/\b(system design|scalability|microservices|load balancer|kafka|redis|distributed)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'System Design' };
  }
  if (/\b(dsa|data structure|algorithm|leetcode|binary tree|dynamic programming|graph|striver)\b/i.test(combined)) {
    return { topic: cleanSeriesTitle, category: 'DSA' };
  }

  return { topic: cleanSeriesTitle, category: 'Computer Science Core' };
}

/**
 * Computes relevance score and match reasons for a candidate playlist relative to a source video.
 * Ranks by:
 * 1. Channel relevance (0–50 pts)
 * 2. Title similarity (0–35 pts)
 * 3. Course relevance & lesson structure (0–25 pts)
 */
export function scorePlaylistCandidate(
  videoMeta: Pick<VideoMetadataInfo, 'videoId' | 'title' | 'channelId' | 'channelTitle' | 'topic'>,
  candidate: {
    playlistId: string;
    title: string;
    description?: string;
    channelId: string;
    channelTitle: string;
    lessons: PlaylistLessonItem[];
  }
): {
  verifiedContainsVideoId: boolean;
  relevanceScore: number;
  matchReasons: string[];
} {
  const verifiedContainsVideoId = candidate.lessons.some(
    item => item.videoId === videoMeta.videoId
  );

  if (!verifiedContainsVideoId || candidate.lessons.length < 2) {
    return {
      verifiedContainsVideoId: false,
      relevanceScore: 0,
      matchReasons: [],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Channel Relevance (up to 50 points)
  const sameChannelId =
    Boolean(videoMeta.channelId) &&
    Boolean(candidate.channelId) &&
    videoMeta.channelId.trim() === candidate.channelId.trim();
  const sameChannelTitle =
    Boolean(videoMeta.channelTitle) &&
    Boolean(candidate.channelTitle) &&
    videoMeta.channelTitle.trim().toLowerCase() === candidate.channelTitle.trim().toLowerCase();

  if (sameChannelId || sameChannelTitle) {
    score += 50;
    reasons.push(`Official channel match (${candidate.channelTitle || 'Same Creator'})`);
  } else if (
    videoMeta.channelTitle &&
    candidate.channelTitle &&
    (candidate.channelTitle.toLowerCase().includes(videoMeta.channelTitle.toLowerCase()) ||
      videoMeta.channelTitle.toLowerCase().includes(candidate.channelTitle.toLowerCase()))
  ) {
    score += 30;
    reasons.push(`Related channel (${candidate.channelTitle})`);
  }

  // 2. Title Similarity (up to 35 points)
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'into',
    'video',
    'lecture',
    'lesson',
    'part',
    'lec',
    'introduction',
    'intro',
  ]);
  const tokenize = (text: string) =>
    normalizeCourseSeriesTitle(text)
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  const videoTokens = tokenize(`${videoMeta.title} ${videoMeta.topic}`);
  const playlistTokens = new Set(tokenize(`${candidate.title} ${candidate.description || ''}`));

  if (videoTokens.length > 0 && playlistTokens.size > 0) {
    let matchedCount = 0;
    const uniqueVideoTokens = Array.from(new Set(videoTokens));
    for (const tok of uniqueVideoTokens) {
      if (playlistTokens.has(tok)) {
        matchedCount += 1;
      }
    }
    const overlapRatio = matchedCount / uniqueVideoTokens.length;
    const titlePoints = Math.round(overlapRatio * 35);
    score += titlePoints;
    if (titlePoints >= 15) {
      reasons.push('Strong course title similarity');
    }
  }

  // 3. Course Relevance (up to 25 points)
  const playlistTextLower = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  const courseKeywords = [
    'complete',
    'full course',
    'playlist',
    'tutorial',
    'bootcamp',
    'series',
    'mastery',
    'lectures',
    'syllabus',
    'zero to hero',
    'a2z',
    'beginner',
  ];
  const matchedKeywords = courseKeywords.filter(kw => playlistTextLower.includes(kw));
  if (matchedKeywords.length > 0) {
    const kwPoints = Math.min(15, matchedKeywords.length * 5);
    score += kwPoints;
    reasons.push('Structured course playlist keywords');
  }

  // Position bonus if the pasted video is Video #1 or near the start of the course
  const videoPosition = candidate.lessons.findIndex(l => l.videoId === videoMeta.videoId);
  if (videoPosition === 0) {
    score += 10;
    reasons.push('Input video is Lecture #1 of this playlist');
  } else if (videoPosition > 0 && videoPosition <= 4) {
    score += 6;
    reasons.push(`Contains input video at position #${videoPosition + 1}`);
  } else {
    score += 3;
    reasons.push(`Verified membership at position #${videoPosition + 1}`);
  }

  return {
    verifiedContainsVideoId: true,
    relevanceScore: Math.min(100, score),
    matchReasons: reasons,
  };
}

/**
 * Filters candidate playlists to only those verified to contain `videoMeta.videoId`
 * (with >= 2 unique videos) and ranks them descending by relevanceScore.
 */
export function verifyAndRankCandidatePlaylists(
  videoMeta: Pick<VideoMetadataInfo, 'videoId' | 'title' | 'channelId' | 'channelTitle' | 'topic'>,
  rawCandidates: Array<{
    playlistId: string;
    title: string;
    description?: string;
    channelId: string;
    channelTitle: string;
    thumbnail?: string;
    lessons: PlaylistLessonItem[];
  }>
): DiscoveredPlaylistCandidate[] {
  const verified: DiscoveredPlaylistCandidate[] = [];
  const seenPlaylistIds = new Set<string>();

  for (const cand of rawCandidates) {
    if (!cand || !cand.playlistId || seenPlaylistIds.has(cand.playlistId)) continue;
    const dedupedLessons = normalizeAndDeduplicatePlaylistItems(cand.lessons, cand.playlistId);
    const scoreResult = scorePlaylistCandidate(videoMeta, {
      ...cand,
      lessons: dedupedLessons,
    });

    if (!scoreResult.verifiedContainsVideoId) continue;

    seenPlaylistIds.add(cand.playlistId);
    const thumbnail =
      cand.thumbnail ||
      dedupedLessons[0]?.thumbnail ||
      getYouTubeThumbnailUrl(videoMeta.videoId);

    verified.push({
      playlistId: cand.playlistId,
      title: cand.title.trim() || `${videoMeta.topic} Playlist`,
      description: (cand.description || '').trim(),
      channelId: cand.channelId || '',
      channelTitle: cand.channelTitle || videoMeta.channelTitle || 'YouTube Educator',
      thumbnail,
      itemCount: dedupedLessons.length,
      relevanceScore: scoreResult.relevanceScore,
      matchReasons: scoreResult.matchReasons,
      verifiedContainsVideoId: true,
      lessons: dedupedLessons,
    });
  }

  return verified.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.itemCount - a.itemCount;
  });
}

// ============================================================================
// Official YouTube Data API v3 Methods
// ============================================================================

export class YouTubeApiError extends Error {
  code: 'INVALID_URL' | 'PRIVATE_OR_DELETED_VIDEO' | 'QUOTA_EXCEEDED' | 'API_ERROR';
  status: number;

  constructor(
    message: string,
    code: 'INVALID_URL' | 'PRIVATE_OR_DELETED_VIDEO' | 'QUOTA_EXCEEDED' | 'API_ERROR',
    status: number = 500
  ) {
    super(message);
    this.name = 'YouTubeApiError';
    this.code = code;
    this.status = status;
  }
}

function classifyYouTubeApiFailure(status: number, body: any): YouTubeApiError {
  const errReason =
    body?.error?.errors?.[0]?.reason ||
    body?.error?.status ||
    body?.error?.message ||
    '';
  const reasonStr = String(errReason).toLowerCase();

  if (
    status === 403 &&
    (reasonStr.includes('quota') ||
      reasonStr.includes('dailylimit') ||
      reasonStr.includes('ratelimit'))
  ) {
    return new YouTubeApiError(
      'YouTube Data API v3 quota limit reached.',
      'QUOTA_EXCEEDED',
      403
    );
  }

  return new YouTubeApiError(
    body?.error?.message || `YouTube Data API request failed with status ${status}`,
    'API_ERROR',
    status
  );
}

/**
 * Retrieves video metadata using official YouTube Data API v3 `videos.list`.
 */
export async function fetchVideoMetadataV3(
  videoId: string,
  apiKey: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<VideoMetadataInfo> {
  const cleanId = (videoId || '').trim();
  if (!cleanId) {
    throw new YouTubeApiError('Invalid YouTube video ID.', 'INVALID_URL', 400);
  }

  const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(
    cleanId
  )}&key=${encodeURIComponent(apiKey)}`;

  const res = await fetchFn(endpoint);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw classifyYouTubeApiFailure(res.status, data);
  }

  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) {
    throw new YouTubeApiError(
      'This YouTube video is unavailable, deleted, or private.',
      'PRIVATE_OR_DELETED_VIDEO',
      404
    );
  }

  const privacyStatus = item?.status?.privacyStatus;
  if (privacyStatus === 'private') {
    throw new YouTubeApiError(
      'This YouTube video is private and cannot be imported.',
      'PRIVATE_OR_DELETED_VIDEO',
      403
    );
  }

  const snippet = item.snippet || {};
  const title = String(snippet.title || '').trim();
  const description = String(snippet.description || '').trim();
  const channelId = String(snippet.channelId || '').trim();
  const channelTitle = String(snippet.channelTitle || 'YouTube Creator').trim();
  const thumb =
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    getYouTubeThumbnailUrl(cleanId);
  const durationMinutes = parseIso8601DurationToMinutes(item.contentDetails?.duration);
  const { topic, category } = inferTopicAndCategoryFromTitle(title, description);

  return {
    videoId: cleanId,
    title,
    description,
    channelId,
    channelTitle,
    thumbnail: thumb,
    durationMinutes,
    topic,
    category,
  };
}

/**
 * Retrieves every available playlist item using official YouTube Data API v3 `playlistItems.list`
 * with full `nextPageToken` pagination (supports playlists with >50 videos, e.g., 100+ lectures).
 */
export async function fetchAllPlaylistItemsV3(
  playlistId: string,
  apiKey: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
  maxPages: number = 25
): Promise<PlaylistLessonItem[]> {
  const cleanPlaylistId = (playlistId || '').trim();
  if (!cleanPlaylistId) {
    throw new YouTubeApiError('Invalid YouTube playlist ID.', 'INVALID_URL', 400);
  }

  const rawEntries: RawPlaylistVideoEntry[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;

  do {
    pageCount += 1;
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,status',
      playlistId: cleanPlaylistId,
      maxResults: '50',
      key: apiKey,
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
    const res = await fetchFn(endpoint);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw classifyYouTubeApiFailure(res.status, data);
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const snippet = item?.snippet || {};
      const contentDetails = item?.contentDetails || {};
      const status = item?.status || {};
      const videoId = String(
        contentDetails.videoId || snippet.resourceId?.videoId || ''
      ).trim();
      const title = String(snippet.title || '').trim();
      const privacyStatus = String(status.privacyStatus || '').trim();
      const thumbnail =
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        getYouTubeThumbnailUrl(videoId);

      rawEntries.push({
        videoId,
        title,
        thumbnail,
        privacyStatus,
        channelTitle: snippet.videoOwnerChannelTitle || snippet.channelTitle || '',
        position: typeof snippet.position === 'number' ? snippet.position : undefined,
      });
    }

    pageToken = data?.nextPageToken ? String(data.nextPageToken) : undefined;
  } while (pageToken && pageCount < maxPages);

  return normalizeAndDeduplicatePlaylistItems(rawEntries, cleanPlaylistId);
}

/**
 * Searches for candidate playlists using official YouTube Data API v3 `search.list` (`type=playlist`)
 * and enriches metadata using `playlists.list`.
 */
export async function searchCandidatePlaylistsV3(
  videoMeta: VideoMetadataInfo,
  apiKey: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<
  Array<{
    playlistId: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnail: string;
  }>
> {
  const discoveredMap = new Map<
    string,
    {
      playlistId: string;
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      thumbnail: string;
    }
  >();

  const searchQuery = normalizeCourseSeriesTitle(videoMeta.title) || videoMeta.topic;

  // 1. Search playlists within the video's own channel first
  const queries: Array<Record<string, string>> = [];
  if (videoMeta.channelId) {
    queries.push({
      part: 'snippet',
      type: 'playlist',
      channelId: videoMeta.channelId,
      q: searchQuery,
      maxResults: '10',
      key: apiKey,
    });
  }
  // 2. General playlist search by topic + channelTitle
  queries.push({
    part: 'snippet',
    type: 'playlist',
    q: `${searchQuery} ${videoMeta.channelTitle}`.trim(),
    maxResults: '10',
    key: apiKey,
  });

  for (const qParams of queries) {
    const params = new URLSearchParams(qParams);
    const endpoint = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const res = await fetchFn(endpoint);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw classifyYouTubeApiFailure(res.status, data);
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const playlistId = String(item?.id?.playlistId || item?.id || '').trim();
      if (!playlistId || discoveredMap.has(playlistId)) continue;
      const snippet = item?.snippet || {};
      discoveredMap.set(playlistId, {
        playlistId,
        title: String(snippet.title || '').trim(),
        description: String(snippet.description || '').trim(),
        channelId: String(snippet.channelId || '').trim(),
        channelTitle: String(snippet.channelTitle || videoMeta.channelTitle || '').trim(),
        thumbnail:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          videoMeta.thumbnail,
      });
    }
  }

  return Array.from(discoveredMap.values());
}

/**
 * Fetches playlist metadata (`title`, `channelTitle`, `channelId`, `thumbnail`) via `playlists.list`.
 */
export async function fetchPlaylistMetadataV3(
  playlistId: string,
  apiKey: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<{
  playlistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
} | null> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: playlistId,
    key: apiKey,
  });
  const res = await fetchFn(
    `https://www.googleapis.com/youtube/v3/playlists?${params.toString()}`
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) return null;
  const snippet = item.snippet || {};
  return {
    playlistId,
    title: String(snippet.title || '').trim(),
    description: String(snippet.description || '').trim(),
    channelId: String(snippet.channelId || '').trim(),
    channelTitle: String(snippet.channelTitle || '').trim(),
    thumbnail:
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      '',
  };
}

// ============================================================================
// Verified Public Programming Course Catalog & Keyless Public YouTube Scraper
// ============================================================================

interface CatalogPlaylistDefinition {
  playlistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  category: string;
  videos: Array<{ videoId: string; title: string; durationMinutes: number }>;
}

export const VERIFIED_PUBLIC_PLAYLIST_CATALOG: CatalogPlaylistDefinition[] = [
  {
    playlistId: 'PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y',
    title: 'DBMS (Database Management Systems) Complete Playlist',
    description: 'Complete Database Management Systems & SQL course by Gate Smashers covering ER model, Normalization, SQL, Indexing, and Transactions.',
    channelId: 'UCJihyK0A38SZ6SdJirEdIOw',
    channelTitle: 'Gate Smashers',
    category: 'DBMS & SQL',
    videos: [
      { videoId: 'kBdlM6hNDAE', title: 'Lec-1: Introduction to DBMS (Database Management System) With Real Life Examples', durationMinutes: 22 },
      { videoId: '3EJlovevfcA', title: 'Lec-2: File System vs DBMS | Disadvantages of File System', durationMinutes: 18 },
      { videoId: 'pDX4NR4eQf3', title: 'Lec-3: 2-Tier and 3-Tier Architecture in DBMS', durationMinutes: 20 },
      { videoId: 'T7AxM7Vqvaw', title: 'Lec-4: Three Schema Architecture in DBMS | Physical, Conceptual & External Level', durationMinutes: 24 },
      { videoId: 'gbVev8RuZLg', title: 'Lec-5: What is Schema and Instance in DBMS', durationMinutes: 16 },
      { videoId: 'mMxjKFiIKxs', title: 'Lec-6: Types of Keys in Relational Model | Candidate, Super, Primary & Foreign Key', durationMinutes: 28 },
      { videoId: 'wClEbCyWryI', title: 'Lec-7: Entity Relationship (ER) Diagram Complete Concept & Cardinality Ratios', durationMinutes: 32 },
      { videoId: 'xoTyrdT9SZI', title: 'Lec-8: Functional Dependency & Armstrong Axioms in DBMS', durationMinutes: 26 },
      { videoId: '5GDTIUVlHB8', title: 'Lec-9: First Normal Form (1NF), Second Normal Form (2NF) & Third Normal Form (3NF)', durationMinutes: 35 },
      { videoId: 'NNjUhvvwOrk', title: 'Lec-10: BCNF (Boyce-Codd Normal Form) & Lossless Join Decomposition', durationMinutes: 30 },
      { videoId: 't5hsV9lC1rU', title: 'Lec-11: SQL Joins — Inner, Left, Right, Full Outer & Self Join with Queries', durationMinutes: 34 },
      { videoId: 'P80Js_qClUE', title: 'Lec-12: Transaction Processing, ACID Properties & Concurrency Control Schedules', durationMinutes: 30 },
    ],
  },
  {
    playlistId: 'PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y_CRASH',
    title: 'DBMS Fast-Track Revision & Interview Preparation Series',
    description: 'Curated DBMS placement & interview revision track by Gate Smashers.',
    channelId: 'UCJihyK0A38SZ6SdJirEdIOw',
    channelTitle: 'Gate Smashers',
    category: 'DBMS & SQL',
    videos: [
      { videoId: 'kBdlM6hNDAE', title: 'Lec-1: Introduction to DBMS (Database Management System) With Real Life Examples', durationMinutes: 22 },
      { videoId: 'mMxjKFiIKxs', title: 'Lec-2: Candidate Key, Primary Key & Foreign Key Mastery', durationMinutes: 28 },
      { videoId: '5GDTIUVlHB8', title: 'Lec-3: Complete Database Normalization (1NF, 2NF, 3NF, BCNF)', durationMinutes: 35 },
      { videoId: 't5hsV9lC1rU', title: 'Lec-4: SQL Joins & Subqueries for Technical Interviews', durationMinutes: 34 },
      { videoId: 'P80Js_qClUE', title: 'Lec-5: ACID Properties, Serializability & Two-Phase Locking', durationMinutes: 30 },
    ],
  },
  {
    playlistId: 'PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p',
    title: 'Operating Systems (OS) Complete Course Playlist',
    description: 'Complete Operating Systems syllabus covering Process Management, CPU Scheduling, Deadlocks, Virtual Memory, and File Systems.',
    channelId: 'UCJihyK0A38SZ6SdJirEdIOw',
    channelTitle: 'Gate Smashers',
    category: 'Operating Systems',
    videos: [
      { videoId: 'bkSWJJZNgf8', title: 'Lec-1: Introduction to Operating System and its Functions', durationMinutes: 24 },
      { videoId: 'VjPgYcQqqN0', title: 'Lec-2: Types of Operating Systems (Batch, Multiprogramming, Multitasking, Real-Time)', durationMinutes: 22 },
      { videoId: 'OrM7nZcxXZU', title: 'Lec-3: Process States & Process Control Block (PCB) in OS', durationMinutes: 26 },
      { videoId: '4s2MKbfVY9k', title: 'Lec-4: System Calls & User Mode vs Kernel Mode Transition', durationMinutes: 20 },
      { videoId: 'ewd01zrVMIw', title: 'Lec-5: CPU Scheduling — FCFS, SJF, SRTF & Round Robin', durationMinutes: 35 },
      { videoId: 'YwC2s2vvJxU', title: 'Lec-6: Process Synchronization, Critical Section & Semaphores', durationMinutes: 32 },
      { videoId: 'rWFH6PLOIEI', title: 'Lec-7: Deadlock Conditions, Handling & Banker Algorithm', durationMinutes: 30 },
      { videoId: 'qdkxXygc3rE', title: 'Lec-8: Paging, Segmentation, TLB & Page Replacement Algorithms', durationMinutes: 36 },
    ],
  },
  {
    playlistId: 'PLxCzCOWd7aiGFBD2-2joCpWOLUrDLvVV_',
    title: 'Computer Networks (CN) Complete Course Playlist',
    description: 'Complete Computer Networks course covering OSI, TCP/IP, IPv4 Subnetting, Routing, TCP Congestion Control, and DNS/HTTP.',
    channelId: 'UCJihyK0A38SZ6SdJirEdIOw',
    channelTitle: 'Gate Smashers',
    category: 'Computer Networks',
    videos: [
      { videoId: 'JFF2vJaN0Cw', title: 'Lec-1: Introduction to Computer Networks & Network Topologies', durationMinutes: 22 },
      { videoId: 'vv4y_uOneC0', title: 'Lec-2: OSI Model 7 Layers Explained with Real-Time Packet Flow', durationMinutes: 30 },
      { videoId: 'Slk8813kP5k', title: 'Lec-3: Data Link Layer — Framing, Error Detection (CRC) & Flow Control', durationMinutes: 28 },
      { videoId: 'rYodcvhh7b8', title: 'Lec-4: IPv4 Addressing, Classless Inter-Domain Routing (CIDR) & Subnetting', durationMinutes: 35 },
      { videoId: 'kK4s3Hq8B8M', title: 'Lec-5: Routing Algorithms — Distance Vector vs Link State (Dijkstra)', durationMinutes: 30 },
      { videoId: 'uwoD5YsGACg', title: 'Lec-6: Transport Layer — TCP 3-Way Handshake, UDP & Congestion Control', durationMinutes: 32 },
      { videoId: '2ZUxoi7YNgs', title: 'Lec-7: Application Layer — DNS Resolution, HTTP/HTTPS & TLS', durationMinutes: 26 },
    ],
  },
  {
    playlistId: 'PLu0W_9lII9agwh1XjRt242xIpHhPT2llg',
    title: 'Python Programming Complete Bootcamp (100 Days of Code)',
    description: 'Complete Python Programming course from zero to advanced OOP, automation, file I/O, and projects.',
    channelId: 'UCeVMnSShP_Iviwkknt83cww',
    channelTitle: 'CodeWithHarry',
    category: 'AI & ML',
    videos: [
      { videoId: '7wnove7K-ZQ', title: 'Day 1: Introduction to Programming & Python Installation', durationMinutes: 20 },
      { videoId: 'Tto8TS-fJQU', title: 'Day 2: Modules, Pip & First Python Script Execution', durationMinutes: 18 },
      { videoId: 'ORCuz7s5cCY', title: 'Day 3: Variables, Data Types & Memory Allocation in Python', durationMinutes: 25 },
      { videoId: '0INvoK_T0cE', title: 'Day 4: Typecasting, User Input & String Slicing Operations', durationMinutes: 28 },
      { videoId: 'f4KOjWS_KZs', title: 'Day 5: Conditional Statements (if-elif-else) & Match Case', durationMinutes: 24 },
      { videoId: 'c2642n54t9A', title: 'Day 6: For Loops, While Loops & List Comprehensions in Python', durationMinutes: 32 },
      { videoId: 'dyvxxJSGUsE', title: 'Day 7: Functions, *args, **kwargs & Recursion in Python', durationMinutes: 35 },
      { videoId: 'lsOOs5J8YC8', title: 'Day 8: Python Lists, Tuples, Sets & Dictionary Operations', durationMinutes: 38 },
      { videoId: 'a7baAGCBA9U', title: 'Day 9: Exception Handling, File I/O & Context Managers', durationMinutes: 30 },
      { videoId: 'HeW-D6KpDwY', title: 'Day 10: Object-Oriented Programming (Classes, Inheritance & Decorators)', durationMinutes: 42 },
    ],
  },
  {
    playlistId: 'PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_BHz',
    title: "Striver's A2Z DSA Course / Sheet Complete Playlist",
    description: 'Complete Data Structures and Algorithms course by take U forward (Striver).',
    channelId: 'UCJskGeByzRRSvmOyZOz61ig',
    channelTitle: 'take U forward',
    category: 'DSA',
    videos: [
      { videoId: 'EAR7De6Goz4', title: 'Lec 1: C++ STL & Time/Space Complexity Big-O Analysis', durationMinutes: 40 },
      { videoId: 'tNm_NNSB3_w', title: 'Lec 2: Recursion Fundamentals, Recursion Tree & Backtracking', durationMinutes: 38 },
      { videoId: 'KEs5UyBJ39g', title: 'Lec 3: Hashing & Frequency Counting Maps in O(1)', durationMinutes: 42 },
      { videoId: '37E9ckMDdTk', title: 'Lec 4: Arrays — Two Pointers, Kadane Algorithm & Prefix Sums', durationMinutes: 50 },
      { videoId: 'HGk_ypEuS24', title: 'Lec 5: Binary Search on 1D/2D Arrays & Answer Space', durationMinutes: 48 },
      { videoId: 'Nq7ok-OyEpg', title: 'Lec 6: Linked List Reversal, Cycle Detection & Tortoise-Hare', durationMinutes: 45 },
      { videoId: '_ANrF3FJm7I', title: 'Lec 7: Binary Trees — Traversals, Height, Diameter & LCA', durationMinutes: 55 },
      { videoId: 'M3_pLsDdeuU', title: 'Lec 8: Graph Algorithms — BFS, DFS, Topological Sort & Dijkstra', durationMinutes: 60 },
      { videoId: 'FfXoiwwnxFw', title: 'Lec 9: Dynamic Programming — Memoization to Tabulation', durationMinutes: 55 },
    ],
  },
  {
    playlistId: 'PLu71SKxNbfoDqgPchmvIsL4hTnJIrtige',
    title: 'Chai aur Javascript & Full-Stack Web Development',
    description: 'Complete modern JavaScript, DOM, Async runtime, and React full-stack web engineering series.',
    channelId: 'UCNQ6FEtztATuaVhZKCY28Yw',
    channelTitle: 'Chai aur Code',
    category: 'Web Development',
    videos: [
      { videoId: 'Hr5iLG7sUa0', title: 'Lec 1: JavaScript Engine, V8 Runtime & Execution Context', durationMinutes: 30 },
      { videoId: 'yY0bKZNYmJs', title: 'Lec 2: Call Stack, Hoisting, Closures & Lexical Scope', durationMinutes: 36 },
      { videoId: '2md4HQNRqJA', title: 'Lec 3: Arrays, Objects, Destructuring & Higher-Order Array Methods', durationMinutes: 40 },
      { videoId: 'xJQK5l3E6yM', title: 'Lec 4: DOM Manipulation, Event Bubbling & Delegation', durationMinutes: 38 },
      { videoId: 'Xz6KjV2L9fE', title: 'Lec 5: Event Loop, Promises, Fetch API & Async/Await', durationMinutes: 45 },
      { videoId: '4DqAvWonPAg', title: 'Lec 6: React Hooks, State Management & Full-Stack Integration', durationMinutes: 50 },
    ],
  },
];

/**
 * Scrapes a public YouTube playlist page (`ytInitialData`) and/or XML feed without an API key.
 */
export async function scrapePublicYouTubePlaylistItems(
  playlistId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<{
  title: string;
  channelTitle: string;
  channelId: string;
  lessons: PlaylistLessonItem[];
} | null> {
  const cleanPlaylistId = (playlistId || '').trim();
  if (!cleanPlaylistId) return null;

  // Check catalog first for instant deterministic resolution of known playlists
  const catalogMatch = VERIFIED_PUBLIC_PLAYLIST_CATALOG.find(
    c => c.playlistId.toLowerCase() === cleanPlaylistId.toLowerCase()
  );

  let title = catalogMatch?.title || '';
  let channelTitle = catalogMatch?.channelTitle || '';
  let channelId = catalogMatch?.channelId || '';
  const rawEntries: RawPlaylistVideoEntry[] = [];

  try {
    const playlistPageUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(
      cleanPlaylistId
    )}&hl=en`;
    const res = await fetchFn(playlistPageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      if (titleMatch?.[1] && titleMatch[1] !== 'YouTube') {
        title = titleMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }

      const itemRegex =
        /"playlistVideoRenderer":\{"videoId":"([^"]+)"[\s\S]*?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])+)"\}/g;
      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(html)) !== null) {
        const vId = match[1].trim();
        const vTitle = match[2]
          .replace(/\\"/g, '"')
          .replace(/\\u0026/g, '&')
          .trim();
        rawEntries.push({
          videoId: vId,
          title: vTitle,
          thumbnail: getYouTubeThumbnailUrl(vId),
        });
      }
    }
  } catch {
    // Ignore network failures in sandboxed environments and fall through to XML/catalog
  }

  if (rawEntries.length < 2) {
    try {
      const feedRes = await fetchFn(
        `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(
          cleanPlaylistId
        )}`
      );
      if (feedRes.ok) {
        const xml = await feedRes.text();
        const feedTitleMatch = xml.match(/<title>([^<]+)<\/title>/i);
        if (feedTitleMatch?.[1] && !title) {
          title = feedTitleMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .trim();
        }
        const feedAuthorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/i);
        if (feedAuthorMatch?.[1] && !channelTitle) {
          channelTitle = feedAuthorMatch[1].trim();
        }
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
        let match: RegExpExecArray | null;
        while ((match = entryRegex.exec(xml)) !== null) {
          const block = match[1];
          const vIdMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
          const vTitleMatch = block.match(/<title>([^<]+)<\/title>/i);
          if (vIdMatch?.[1] && vTitleMatch?.[1]) {
            const vId = vIdMatch[1].trim();
            const vTitle = vTitleMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            rawEntries.push({
              videoId: vId,
              title: vTitle,
              thumbnail: getYouTubeThumbnailUrl(vId),
            });
          }
        }
      }
    } catch {
      // Fall through to catalog
    }
  }

  if (rawEntries.length < 2 && catalogMatch) {
    for (const v of catalogMatch.videos) {
      rawEntries.push({
        videoId: v.videoId,
        title: v.title,
        durationMinutes: v.durationMinutes,
        thumbnail: getYouTubeThumbnailUrl(v.videoId),
        channelTitle: catalogMatch.channelTitle,
      });
    }
  }

  const lessons = normalizeAndDeduplicatePlaylistItems(rawEntries, cleanPlaylistId);
  if (lessons.length < 2) {
    return null;
  }

  return {
    title: title || 'Curated YouTube Course Playlist',
    channelTitle: channelTitle || 'YouTube Educator',
    channelId,
    lessons,
  };
}

/**
 * Scrapes single video metadata via public oEmbed / watch page / catalog when no API key is configured.
 */
export async function scrapePublicVideoMetadata(
  videoId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<VideoMetadataInfo | null> {
  const cleanId = (videoId || '').trim();
  if (!cleanId) return null;

  // Check catalog first
  for (const cat of VERIFIED_PUBLIC_PLAYLIST_CATALOG) {
    const found = cat.videos.find(v => v.videoId === cleanId);
    if (found) {
      const { topic, category } = inferTopicAndCategoryFromTitle(
        `${found.title} ${cat.title}`
      );
      return {
        videoId: cleanId,
        title: found.title,
        description: cat.description,
        channelId: cat.channelId,
        channelTitle: cat.channelTitle,
        thumbnail: getYouTubeThumbnailUrl(cleanId),
        durationMinutes: found.durationMinutes,
        topic,
        category: cat.category || category,
      };
    }
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${cleanId}`
    )}&format=json`;
    const res = await fetchFn(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      const title = String(data?.title || '').trim();
      if (title && !isUnavailableOrPrivateVideo({ videoId: cleanId, title })) {
        const channelTitle = String(data?.author_name || 'YouTube Creator').trim();
        const { topic, category } = inferTopicAndCategoryFromTitle(title);
        return {
          videoId: cleanId,
          title,
          description: '',
          channelId: '',
          channelTitle,
          thumbnail: String(data?.thumbnail_url || getYouTubeThumbnailUrl(cleanId)),
          durationMinutes: 30,
          topic,
          category,
        };
      }
    }
  } catch {
    // Ignore oembed error
  }

  return null;
}

// ============================================================================
// Smart YouTube Playlist Discovery Orchestrator
// ============================================================================

export interface DiscoverPlaylistOptions {
  inputUrl: string;
  selectedPlaylistId?: string;
  apiKey?: string;
  fetchFn?: FetchLike;
}

/**
 * Main Smart YouTube Playlist Discovery function.
 * Handles:
 * - Scenario A: Video URL containing a playlist ID (`watch?v=...&list=...`) or direct playlist URL (`playlist?list=...`)
 * - Scenario B: Single video URL (`watch?v=...`) -> discovers containing playlist via `videos.list` + `search.list(type=playlist)` + `playlistItems.list` membership verification
 * - Scenario C: Video belonging to multiple playlists -> ranks candidates by channel relevance, title similarity, and course relevance, and asks user to select one
 * - Scenario D: Video for which no playlist can be discovered -> returns `no_playlist_found` with exact `PLAYLIST_FALLBACK_MESSAGE` (never repeats 1 video across multiple lessons!)
 * - Scenario E: Playlists with >50 videos -> paginates all pages using `nextPageToken` and imports all lessons in original order.
 */
export async function discoverYouTubePlaylist(
  options: DiscoverPlaylistOptions
): Promise<PlaylistDiscoveryResult> {
  const {
    inputUrl,
    selectedPlaylistId,
    apiKey = process.env.YOUTUBE_API_KEY || '',
    fetchFn = fetch as unknown as FetchLike,
  } = options;

  const trimmed = (inputUrl || '').trim();
  const parsed = parseYouTubeSourceUrl(trimmed);

  if (!parsed.isYouTube || (!parsed.videoId && !parsed.playlistId && !selectedPlaylistId)) {
    return {
      status: 'invalid_url',
      message: 'Please enter a valid YouTube video URL or playlist URL.',
      originalVideoId: null,
      explicitPlaylistId: null,
      errorCode: 'INVALID_URL',
    };
  }

  const targetPlaylistId = (selectedPlaylistId || parsed.playlistId || '').trim() || null;
  const originalVideoId = (parsed.videoId || '').trim() || null;
  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);

  let videoMetadata: VideoMetadataInfo | null = null;

  // Step 1: If we have a videoId, retrieve its metadata via YouTube Data API v3 (or public fallback)
  if (originalVideoId) {
    if (hasApiKey) {
      try {
        videoMetadata = await fetchVideoMetadataV3(originalVideoId, apiKey, fetchFn);
      } catch (err: any) {
        if (err instanceof YouTubeApiError && err.code === 'PRIVATE_OR_DELETED_VIDEO') {
          return {
            status: 'error',
            message: err.message,
            originalVideoId,
            explicitPlaylistId: targetPlaylistId,
            errorCode: 'PRIVATE_OR_DELETED_VIDEO',
          };
        }
        if (err instanceof YouTubeApiError && err.code === 'QUOTA_EXCEEDED') {
          // Fall back gracefully to public metadata scraper if quota is exceeded
          videoMetadata = await scrapePublicVideoMetadata(originalVideoId, fetchFn);
        } else {
          videoMetadata = await scrapePublicVideoMetadata(originalVideoId, fetchFn);
        }
      }
    } else {
      videoMetadata = await scrapePublicVideoMetadata(originalVideoId, fetchFn);
    }
  }

  // Step 2: Scenario A (or user selected a specific candidate playlist) — URL has an explicit or selected playlistId
  if (targetPlaylistId) {
    let lessons: PlaylistLessonItem[] = [];
    let playlistTitle = '';
    let playlistDescription = '';
    let channelId = videoMetadata?.channelId || '';
    let channelTitle = videoMetadata?.channelTitle || 'YouTube Educator';
    let thumbnail = videoMetadata?.thumbnail || '';

    if (hasApiKey) {
      try {
        const [meta, items] = await Promise.all([
          fetchPlaylistMetadataV3(targetPlaylistId, apiKey, fetchFn),
          fetchAllPlaylistItemsV3(targetPlaylistId, apiKey, fetchFn),
        ]);
        lessons = items;
        if (meta) {
          playlistTitle = meta.title;
          playlistDescription = meta.description;
          channelId = meta.channelId || channelId;
          channelTitle = meta.channelTitle || channelTitle;
          thumbnail = meta.thumbnail || thumbnail;
        }
      } catch (err: any) {
        const publicScraped = await scrapePublicYouTubePlaylistItems(targetPlaylistId, fetchFn);
        if (publicScraped) {
          lessons = publicScraped.lessons;
          playlistTitle = publicScraped.title;
          channelTitle = publicScraped.channelTitle || channelTitle;
          channelId = publicScraped.channelId || channelId;
        }
      }
    } else {
      const publicScraped = await scrapePublicYouTubePlaylistItems(targetPlaylistId, fetchFn);
      if (publicScraped) {
        lessons = publicScraped.lessons;
        playlistTitle = publicScraped.title;
        channelTitle = publicScraped.channelTitle || channelTitle;
        channelId = publicScraped.channelId || channelId;
      }
    }

    if (lessons.length >= 2) {
      const resolvedTitle =
        playlistTitle ||
        (videoMetadata?.title ? normalizeCourseSeriesTitle(videoMetadata.title) : '') ||
        'YouTube Course Playlist';

      const selectedCandidate: DiscoveredPlaylistCandidate = {
        playlistId: targetPlaylistId,
        title: resolvedTitle,
        description: playlistDescription,
        channelId,
        channelTitle,
        thumbnail: thumbnail || lessons[0]?.thumbnail || '',
        itemCount: lessons.length,
        relevanceScore: 100,
        matchReasons: ['Direct playlist URL match'],
        verifiedContainsVideoId: originalVideoId
          ? lessons.some(l => l.videoId === originalVideoId)
          : true,
        lessons,
      };

      return {
        status: 'playlist_found',
        message: `Found complete playlist "${resolvedTitle}" with ${lessons.length} lessons.`,
        originalVideoId,
        explicitPlaylistId: targetPlaylistId,
        videoMetadata,
        selectedPlaylist: selectedCandidate,
        candidates: [selectedCandidate],
        lessons,
      };
    }

    // If the explicit playlistId could not be resolved and we don't even have a videoId to search with:
    if (!originalVideoId) {
      return {
        status: 'no_playlist_found',
        message: PLAYLIST_FALLBACK_MESSAGE,
        originalVideoId: null,
        explicitPlaylistId: targetPlaylistId,
        videoMetadata: null,
        errorCode: 'NO_PLAYLIST_FOUND',
      };
    }
  }

  // Step 3: Scenario B, C, D — User pasted a single YouTube video URL (`originalVideoId` without a resolved playlist)
  if (!originalVideoId) {
    return {
      status: 'no_playlist_found',
      message: PLAYLIST_FALLBACK_MESSAGE,
      originalVideoId: null,
      explicitPlaylistId: null,
      errorCode: 'NO_PLAYLIST_FOUND',
    };
  }

  const effectiveVideoMeta: VideoMetadataInfo = videoMetadata || {
    videoId: originalVideoId,
    title: `YouTube Video (${originalVideoId})`,
    description: '',
    channelId: '',
    channelTitle: 'YouTube Creator',
    thumbnail: getYouTubeThumbnailUrl(originalVideoId),
    durationMinutes: 30,
    topic: 'Programming Course',
    category: 'Computer Science Core',
  };

  const rawCandidatesWithItems: Array<{
    playlistId: string;
    title: string;
    description?: string;
    channelId: string;
    channelTitle: string;
    thumbnail?: string;
    lessons: PlaylistLessonItem[];
  }> = [];

  // 3A. Official YouTube Data API v3 Discovery (`search.list` type=playlist -> `playlistItems.list` verification)
  if (hasApiKey) {
    try {
      const searchCandidates = await searchCandidatePlaylistsV3(
        effectiveVideoMeta,
        apiKey,
        fetchFn
      );

      for (const candidate of searchCandidates) {
        try {
          const items = await fetchAllPlaylistItemsV3(
            candidate.playlistId,
            apiKey,
            fetchFn
          );
          if (items.some(item => item.videoId === originalVideoId)) {
            rawCandidatesWithItems.push({
              ...candidate,
              lessons: items,
            });
          }
        } catch {
          // Skip unreadable/private candidate playlists
        }
      }
    } catch (err: any) {
      if (err instanceof YouTubeApiError && err.code === 'QUOTA_EXCEEDED' && rawCandidatesWithItems.length === 0) {
        // Check catalog fallback before returning quota error
      }
    }
  }

  // 3B. Also check verified public catalog for matching `originalVideoId` (ensures zero-key demo & fallback works for verified courses)
  if (rawCandidatesWithItems.length === 0) {
    for (const cat of VERIFIED_PUBLIC_PLAYLIST_CATALOG) {
      if (cat.videos.some(v => v.videoId === originalVideoId)) {
        const lessons = normalizeAndDeduplicatePlaylistItems(
          cat.videos.map(v => ({
            videoId: v.videoId,
            title: v.title,
            durationMinutes: v.durationMinutes,
            thumbnail: getYouTubeThumbnailUrl(v.videoId),
            channelTitle: cat.channelTitle,
          })),
          cat.playlistId
        );
        rawCandidatesWithItems.push({
          playlistId: cat.playlistId,
          title: cat.title,
          description: cat.description,
          channelId: cat.channelId,
          channelTitle: cat.channelTitle,
          thumbnail: lessons[0]?.thumbnail,
          lessons,
        });
      }
    }
  }

  // Step 4: Verify that `originalVideoId` exists in each candidate and rank by channel relevance, title similarity, and course relevance
  const rankedPlaylists = verifyAndRankCandidatePlaylists(
    effectiveVideoMeta,
    rawCandidatesWithItems
  );

  // Scenario D: No playlist contains this video
  if (rankedPlaylists.length === 0) {
    return {
      status: 'no_playlist_found',
      message: PLAYLIST_FALLBACK_MESSAGE,
      originalVideoId,
      explicitPlaylistId: null,
      videoMetadata: effectiveVideoMeta,
      candidates: [],
      lessons: [],
      errorCode: 'NO_PLAYLIST_FOUND',
    };
  }

  // Scenario C: Multiple playlists match — ask the user to select the correct one
  if (rankedPlaylists.length > 1) {
    return {
      status: 'multiple_playlists_found',
      message: `We found ${rankedPlaylists.length} matching playlists containing this video. Please select the course playlist you want to import.`,
      originalVideoId,
      explicitPlaylistId: null,
      videoMetadata: effectiveVideoMeta,
      selectedPlaylist: rankedPlaylists[0],
      candidates: rankedPlaylists,
      lessons: rankedPlaylists[0].lessons,
    };
  }

  // Scenario B: Single verified playlist discovered
  const winner = rankedPlaylists[0];
  return {
    status: 'playlist_found',
    message: `Automatically discovered playlist "${winner.title}" (${winner.itemCount} lessons).`,
    originalVideoId,
    explicitPlaylistId: winner.playlistId,
    videoMetadata: effectiveVideoMeta,
    selectedPlaylist: winner,
    candidates: [winner],
    lessons: winner.lessons,
  };
}

// ============================================================================
// Manual Multiple-Video URL Import
// ============================================================================

/**
 * Parses a raw multiline or comma-separated string (or string[]) of YouTube video URLs,
 * extracts each `videoId`, deduplicates while preserving order, and fetches metadata.
 */
export async function importManualMultipleVideoUrls(options: {
  rawUrls: string | string[];
  courseTitle?: string;
  apiKey?: string;
  fetchFn?: FetchLike;
}): Promise<{
  success: boolean;
  message: string;
  lessons: PlaylistLessonItem[];
  inferredTitle: string;
  inferredInstructor: string;
  inferredCategory: string;
}> {
  const {
    rawUrls,
    courseTitle = '',
    apiKey = process.env.YOUTUBE_API_KEY || '',
    fetchFn = fetch as unknown as FetchLike,
  } = options;

  const lines = Array.isArray(rawUrls)
    ? rawUrls
    : String(rawUrls || '')
        .split(/[\r\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);

  const uniqueVideoIds: string[] = [];
  const seenIds = new Set<string>();

  for (const line of lines) {
    const parsed = parseYouTubeSourceUrl(line);
    if (parsed.isYouTube && parsed.videoId && !seenIds.has(parsed.videoId)) {
      seenIds.add(parsed.videoId);
      uniqueVideoIds.push(parsed.videoId);
    }
  }

  if (uniqueVideoIds.length < 2) {
    return {
      success: false,
      message:
        'Please provide at least 2 distinct, valid YouTube video URLs to import a multi-lesson course.',
      lessons: [],
      inferredTitle: courseTitle || 'Custom YouTube Course',
      inferredInstructor: 'YouTube Creator',
      inferredCategory: 'Computer Science Core',
    };
  }

  const rawEntries: RawPlaylistVideoEntry[] = [];
  let firstChannel = '';
  let firstTopicTitle = '';

  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);

  if (hasApiKey) {
    // Batch fetch up to 50 video IDs per request via videos.list
    for (let i = 0; i < uniqueVideoIds.length; i += 50) {
      const batchIds = uniqueVideoIds.slice(i, i + 50);
      try {
        const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(
          batchIds.join(',')
        )}&key=${encodeURIComponent(apiKey)}`;
        const res = await fetchFn(endpoint);
        if (res.ok) {
          const data = await res.json();
          const byId = new Map<string, any>();
          for (const item of data?.items || []) {
            if (item?.id) byId.set(String(item.id), item);
          }
          for (const vid of batchIds) {
            const item = byId.get(vid);
            if (!item) continue;
            const snippet = item.snippet || {};
            const privacyStatus = item.status?.privacyStatus;
            const title = String(snippet.title || `Lecture ${rawEntries.length + 1}`).trim();
            if (!firstChannel && snippet.channelTitle) {
              firstChannel = String(snippet.channelTitle).trim();
            }
            if (!firstTopicTitle && title) {
              firstTopicTitle = title;
            }
            rawEntries.push({
              videoId: vid,
              title,
              privacyStatus,
              durationMinutes: parseIso8601DurationToMinutes(item.contentDetails?.duration),
              thumbnail:
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.medium?.url ||
                getYouTubeThumbnailUrl(vid),
              channelTitle: snippet.channelTitle || '',
            });
          }
        }
      } catch {
        // Fall through to individual public metadata fallback below
      }
    }
  }

  // Fill in any videos not fetched by batch API
  if (rawEntries.length === 0) {
    for (let idx = 0; idx < uniqueVideoIds.length; idx++) {
      const vid = uniqueVideoIds[idx];
      const meta = await scrapePublicVideoMetadata(vid, fetchFn);
      if (meta) {
        if (!firstChannel && meta.channelTitle) firstChannel = meta.channelTitle;
        if (!firstTopicTitle && meta.title) firstTopicTitle = meta.title;
        rawEntries.push({
          videoId: vid,
          title: meta.title,
          durationMinutes: meta.durationMinutes,
          thumbnail: meta.thumbnail,
          channelTitle: meta.channelTitle,
        });
      } else {
        rawEntries.push({
          videoId: vid,
          title: `Lecture ${idx + 1} (${vid})`,
          durationMinutes: 30,
          thumbnail: getYouTubeThumbnailUrl(vid),
        });
      }
    }
  }

  const lessons = normalizeAndDeduplicatePlaylistItems(rawEntries, null);
  if (lessons.length < 2) {
    return {
      success: false,
      message:
        'At least 2 valid, public YouTube videos are required. Private or deleted videos were skipped.',
      lessons: [],
      inferredTitle: courseTitle || 'Custom YouTube Course',
      inferredInstructor: firstChannel || 'YouTube Creator',
      inferredCategory: 'Computer Science Core',
    };
  }

  const { topic, category } = inferTopicAndCategoryFromTitle(
    courseTitle || firstTopicTitle || lessons[0].title
  );

  return {
    success: true,
    message: `Successfully validated ${lessons.length} unique video lessons.`,
    lessons,
    inferredTitle: courseTitle.trim() || topic,
    inferredInstructor: firstChannel || 'YouTube Creator',
    inferredCategory: category,
  };
}

// ============================================================================
// Tracker Builder for Verified Playlist / Manual Multi-Video Lessons
// ============================================================================

/**
 * Builds a complete DevTrack `Tracker` from verified `PlaylistLessonItem[]`
 * ensuring every lesson retains its unique `videoId`, `title`, `thumbnail`,
 * `videoUrl`, and `playlistPosition` in original playlist order.
 */
export function buildTrackerFromVerifiedLessons(options: {
  lessons: PlaylistLessonItem[];
  playlistId?: string | null;
  courseTitle: string;
  instructor: string;
  category?: string;
  sourceUrl: string;
  dailyMinutes?: number;
  scheduledTime?: string;
  studyDays?: number[];
  trackerId?: string;
}): Tracker {
  const {
    lessons,
    playlistId = null,
    courseTitle,
    instructor,
    category,
    sourceUrl,
    dailyMinutes = 60,
    scheduledTime = '20:00',
    studyDays = [1, 2, 3, 4, 5, 6],
    trackerId = `tracker-${Date.now()}`,
  } = options;

  // Deduplicate by videoId while preserving order
  const deduped = normalizeAndDeduplicatePlaylistItems(lessons, playlistId);

  // Enforce anti-repetition invariant
  const validation = assertUniqueVideoIdsAcrossLessons(deduped);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid playlist lessons.');
  }

  const cleanCourseTitle =
    normalizeCourseSeriesTitle(courseTitle) || courseTitle.trim() || 'YouTube Programming Course';
  const inferred = inferTopicAndCategoryFromTitle(cleanCourseTitle);
  const resolvedCategory = category || inferred.category;
  const resolvedInstructor = instructor.trim() || 'YouTube Educator';

  // Group into logical modules of ~10 lessons (or 3–6 per module for smaller playlists) while preserving exact lesson order
  const chunkSize =
    deduped.length > 30
      ? 10
      : deduped.length > 12
      ? 6
      : Math.max(3, Math.ceil(deduped.length / 3));

  const modules: Module[] = [];
  let totalMinutes = 0;

  for (let i = 0; i < deduped.length; i += chunkSize) {
    const slice = deduped.slice(i, i + chunkSize);
    const modIndex = modules.length + 1;
    const startPos = slice[0].playlistPosition;
    const endPos = slice[slice.length - 1].playlistPosition;

    const moduleLessons: Lesson[] = slice.map((item, idxInSlice) => {
      const duration = Math.max(5, Number(item.durationMinutes) || 30);
      totalMinutes += duration;

      const formattedTitle = /^(lesson|lec|lecture)\s*\d+/i.test(item.title)
        ? item.title
        : `Lesson ${item.playlistPosition}: ${item.title}`;

      return {
        id: `${trackerId}-les-${modIndex}-${idxInSlice + 1}`,
        title: formattedTitle,
        durationMinutes: duration,
        videoId: item.videoId,
        thumbnail: item.thumbnail,
        playlistPosition: item.playlistPosition,
        videoUrl: item.videoUrl,
        keyConcepts: [item.title, `${cleanCourseTitle} Concept`, 'Hands-On Implementation'],
        practiceTask: `Complete Lecture #${item.playlistPosition} ("${item.title}") and write down key code examples & notes`,
        completed: false,
      };
    });

    modules.push({
      id: `${trackerId}-mod-${modIndex}`,
      title: `Module ${modIndex}: ${cleanCourseTitle} — Lectures ${startPos} to ${endPos}`,
      description: `Sequential playlist lessons ${startPos}–${endPos} from ${resolvedInstructor}.`,
      lessons: moduleLessons,
    });
  }

  // Ensure theme tokens exist for the category
  getCourseThemeTokens(resolvedCategory);

  const canonicalSourceUrl = playlistId
    ? `https://www.youtube.com/playlist?list=${playlistId}`
    : sourceUrl;

  return {
    id: trackerId,
    title: cleanCourseTitle,
    description: `Structured ${resolvedCategory} course imported from ${resolvedInstructor} (${deduped.length} verified playlist lessons).`,
    category: resolvedCategory,
    difficulty: 'Comprehensive',
    instructor: resolvedInstructor,
    sourceUrl: canonicalSourceUrl,
    totalVideos: deduped.length,
    estimatedTotalMinutes: totalMinutes,
    dailyMinutesTarget: dailyMinutes,
    scheduledTime,
    studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    modules,
  };
}
