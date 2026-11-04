import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Youtube,
  Clock,
  Calendar,
  Check,
  AlertCircle,
  Loader2,
  BookOpen,
  ListVideo,
  Layers,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import {
  Tracker,
  DiscoveredPlaylistCandidate,
  PlaylistDiscoveryResult,
} from '../types';
import {
  buildDynamicTrackerFromInput,
  fetchYouTubeMetadataClientSide,
  parseYouTubeSourceUrl,
  PACING_PRESETS,
} from '../utils/studyWorkspaceLogic';
import {
  discoverYouTubePlaylist,
  importManualMultipleVideoUrls,
  buildTrackerFromVerifiedLessons,
  PLAYLIST_FALLBACK_MESSAGE,
} from '../utils/youtubePlaylistDiscovery';

interface CreateTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTracker: (newTracker: Tracker) => void;
}

const POPULAR_COURSE_TEMPLATES = [
  {
    label: 'DBMS First Video (Smart Discovery)',
    topic: 'DBMS (Database Management Systems)',
    url: 'https://www.youtube.com/watch?v=kBdlM6hNDAE',
  },
  {
    label: 'Operating Systems (OS)',
    topic: 'Operating Systems (OS) Complete Course',
    url: 'https://www.youtube.com/watch?v=bkSWJJZNgf8',
  },
  {
    label: 'Python Full Course',
    topic: 'Python Programming & Automation Mastery',
    url: 'https://www.youtube.com/watch?v=7wnove7K-ZQ',
  },
  {
    label: "Striver's A2Z DSA",
    topic: "Striver's A2Z DSA Master Path",
    url: 'https://youtube.com/playlist?list=PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_BHz',
  },
  {
    label: 'Full Stack Web Dev',
    topic: 'Full Stack Web Development (MERN Mastery)',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoDqgPchmvIsL4hTnJIrtige',
  },
];

type FallbackImportMode = 'direct_playlist' | 'manual_multi_video';

export const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
  isOpen,
  onClose,
  onSaveTracker,
}) => {
  const [courseTopic, setCourseTopic] = useState('');
  const [userEditedTopic, setUserEditedTopic] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [discoveryResult, setDiscoveryResult] = useState<PlaylistDiscoveryResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<DiscoveredPlaylistCandidate | null>(
    null
  );
  const [isDetectingUrl, setIsDetectingUrl] = useState(false);
  const [fallbackMode, setFallbackMode] = useState<FallbackImportMode>('direct_playlist');
  const [manualVideoUrlsText, setManualVideoUrlsText] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [scheduledTime, setScheduledTime] = useState<string>('20:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon-Sat
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importProgressPercent, setImportProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const parsedInputSource = React.useMemo(() => parseYouTubeSourceUrl(inputUrl.trim()), [inputUrl]);

  // Smart YouTube Playlist Discovery whenever user pastes/types a YouTube video or playlist URL
  useEffect(() => {
    const trimmed = inputUrl.trim();
    const parsed = parseYouTubeSourceUrl(trimmed);
    if (!parsed.isYouTube) {
      setDiscoveryResult(null);
      setSelectedCandidate(null);
      setIsDetectingUrl(false);
      return;
    }

    let cancelled = false;
    setIsDetectingUrl(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const timer = setTimeout(async () => {
      try {
        let result: PlaylistDiscoveryResult | null = null;
        try {
          const res = await fetch('/api/youtube/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmed }),
          });
          const payload = await res.json();
          if (payload?.data) {
            result = payload.data as PlaylistDiscoveryResult;
          }
        } catch {
          result = await discoverYouTubePlaylist({ inputUrl: trimmed });
        }

        if (!result) {
          result = await discoverYouTubePlaylist({ inputUrl: trimmed });
        }

        if (cancelled) return;
        setIsDetectingUrl(false);
        setDiscoveryResult(result);

        if (
          (result.status === 'playlist_found' || result.status === 'multiple_playlists_found') &&
          result.selectedPlaylist
        ) {
          setSelectedCandidate(result.selectedPlaylist);
          if (!userEditedTopic) {
            setCourseTopic(result.selectedPlaylist.title);
          }
        } else {
          setSelectedCandidate(null);
          if (!userEditedTopic) {
            const realDetectedTitle =
              result.videoMetadata?.title &&
              !result.videoMetadata.title.startsWith('YouTube Video (')
                ? result.videoMetadata.topic || result.videoMetadata.title
                : '';
            setCourseTopic(realDetectedTitle);
          }
        }
      } catch {
        if (!cancelled) {
          setIsDetectingUrl(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputUrl, userEditedTopic]);

  if (!isOpen) return null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSelectQuickTemplate = (tpl: { label: string; topic: string; url: string }) => {
    setCourseTopic(tpl.topic);
    setUserEditedTopic(true);
    setInputUrl(tpl.url);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const resetAndClose = () => {
    setCourseTopic('');
    setUserEditedTopic(false);
    setInputUrl('');
    setDiscoveryResult(null);
    setSelectedCandidate(null);
    setManualVideoUrlsText('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(false);
    setImportProgressPercent(0);
    onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = inputUrl.trim();
    const trimmedTopic = courseTopic.trim();
    const uniqueTrackerId = `tracker-${Date.now()}`;

    // Case 1: User is in Manual Multiple-Video URL Import mode
    if (
      discoveryResult?.status === 'no_playlist_found' &&
      fallbackMode === 'manual_multi_video'
    ) {
      if (!manualVideoUrlsText.trim()) {
        setErrorMsg('Please paste at least 2 YouTube video URLs (one per line) to import.');
        return;
      }

      setErrorMsg(null);
      setIsLoading(true);
      setImportProgressPercent(25);
      setLoadingStep('Validating & deduplicating manual YouTube video URLs...');

      try {
        setImportProgressPercent(65);
        const imported = await importManualMultipleVideoUrls({
          rawUrls: manualVideoUrlsText,
          courseTitle: trimmedTopic || discoveryResult.videoMetadata?.topic || 'Custom Programming Course',
        });

        if (!imported.success || imported.lessons.length < 2) {
          setErrorMsg(imported.message);
          setIsLoading(false);
          setImportProgressPercent(0);
          return;
        }

        setImportProgressPercent(95);
        setLoadingStep(`Importing ${imported.lessons.length} unique lessons in order...`);

        const manualTracker = buildTrackerFromVerifiedLessons({
          lessons: imported.lessons,
          playlistId: null,
          courseTitle: trimmedTopic || imported.inferredTitle,
          instructor: imported.inferredInstructor,
          category: imported.inferredCategory,
          sourceUrl: imported.lessons[0].videoUrl,
          dailyMinutes,
          scheduledTime,
          studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
          trackerId: uniqueTrackerId,
        });

        setImportProgressPercent(100);
        setSuccessMsg(`Imported ${imported.lessons.length} unique lessons!`);
        onSaveTracker(manualTracker);
        resetAndClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to import manual video URLs.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!trimmedUrl && !trimmedTopic) {
      setErrorMsg('Please enter a YouTube playlist/video link or a course topic.');
      return;
    }

    // Critical Bug Prevention: Never pretend a complete playlist has been found when only 1 video is available
    if (parsedInputSource.isYouTube && discoveryResult?.status === 'no_playlist_found') {
      setErrorMsg(PLAYLIST_FALLBACK_MESSAGE);
      return;
    }

    if (parsedInputSource.isYouTube && discoveryResult?.status === 'error') {
      setErrorMsg(discoveryResult.message || 'Unable to import this YouTube video.');
      return;
    }

    // Case 2: A verified playlist candidate was discovered or selected by the user
    if (selectedCandidate && selectedCandidate.lessons.length >= 2) {
      setErrorMsg(null);
      setIsLoading(true);
      setImportProgressPercent(35);
      setLoadingStep(
        `Verifying ${selectedCandidate.lessons.length} playlist items & deduplicating video IDs...`
      );

      try {
        setImportProgressPercent(85);
        const resolvedCourseTitle =
          trimmedTopic &&
          !selectedCandidate.title.toLowerCase().includes(trimmedTopic.toLowerCase())
            ? `${trimmedTopic}: ${selectedCandidate.title}`
            : selectedCandidate.title;

        const verifiedTracker = buildTrackerFromVerifiedLessons({
          lessons: selectedCandidate.lessons,
          playlistId: selectedCandidate.playlistId,
          courseTitle: resolvedCourseTitle,
          instructor: selectedCandidate.channelTitle,
          category: discoveryResult?.videoMetadata?.category,
          sourceUrl: `https://www.youtube.com/playlist?list=${selectedCandidate.playlistId}`,
          dailyMinutes,
          scheduledTime,
          studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
          trackerId: uniqueTrackerId,
        });

        setImportProgressPercent(100);
        onSaveTracker(verifiedTracker);
        resetAndClose();
        return;
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to build course tracker from playlist.');
        setIsLoading(false);
        return;
      }
    }

    const effectiveUrl = trimmedUrl || trimmedTopic;
    const effectiveTopic = trimmedTopic || '';

    setErrorMsg(null);
    setIsLoading(true);
    setImportProgressPercent(25);
    setLoadingStep('Searching YouTube playlists & verifying lesson order...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch('/api/extract-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: effectiveUrl,
          rawTopic: effectiveTopic,
          dailyMinutes,
          scheduledTime,
          studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
          selectedPlaylistId: selectedCandidate?.playlistId,
          requireVerifiedPlaylist: parsedInputSource.isYouTube,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setImportProgressPercent(75);
      setLoadingStep('Structuring day-by-day modules, exercises, and YouTube links...');

      const result = await response.json();

      if (result.status === 'no_playlist_found') {
        if (result.discovery) {
          setDiscoveryResult(result.discovery);
        }
        setErrorMsg(PLAYLIST_FALLBACK_MESSAGE);
        setIsLoading(false);
        setImportProgressPercent(0);
        return;
      }

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract syllabus');
      }

      const newTracker = buildDynamicTrackerFromInput({
        inputUrl: effectiveUrl,
        rawTopic: effectiveTopic,
        extractedData: result.data,
        dailyMinutes,
        scheduledTime,
        studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
        trackerId: uniqueTrackerId,
      });

      setImportProgressPercent(100);
      onSaveTracker(newTracker);
      resetAndClose();
    } catch (err: any) {
      if (parsedInputSource.isYouTube) {
        const fallbackDiscovery = await discoverYouTubePlaylist({ inputUrl: effectiveUrl });
        setDiscoveryResult(fallbackDiscovery);
        if (fallbackDiscovery.status === 'no_playlist_found') {
          setErrorMsg(PLAYLIST_FALLBACK_MESSAGE);
          setIsLoading(false);
          setImportProgressPercent(0);
          return;
        }
        if (fallbackDiscovery.selectedPlaylist) {
          const tracker = buildTrackerFromVerifiedLessons({
            lessons: fallbackDiscovery.selectedPlaylist.lessons,
            playlistId: fallbackDiscovery.selectedPlaylist.playlistId,
            courseTitle:
              effectiveTopic || fallbackDiscovery.selectedPlaylist.title,
            instructor: fallbackDiscovery.selectedPlaylist.channelTitle,
            category: fallbackDiscovery.videoMetadata?.category,
            sourceUrl: `https://www.youtube.com/playlist?list=${fallbackDiscovery.selectedPlaylist.playlistId}`,
            dailyMinutes,
            scheduledTime,
            studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
            trackerId: uniqueTrackerId,
          });
          onSaveTracker(tracker);
          resetAndClose();
          return;
        }
      }

      const clientMeta = await fetchYouTubeMetadataClientSide(effectiveUrl);
      const dynamicTracker = buildDynamicTrackerFromInput({
        inputUrl: effectiveUrl,
        rawTopic: effectiveTopic || clientMeta?.title || '',
        extractedData: clientMeta || undefined,
        dailyMinutes,
        scheduledTime,
        studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
        trackerId: uniqueTrackerId,
      });

      onSaveTracker(dynamicTracker);
      resetAndClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Add New YouTube Course / Study Track
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            data-testid="playlist-discovery-error"
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Resource URL input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              YouTube Video URL or Playlist Link
            </label>
            <div className="relative">
              <Youtube className="w-4 h-4 text-rose-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="Paste first video URL (e.g. https://www.youtube.com/watch?v=...) or playlist URL"
                className="w-full text-xs pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                disabled={isLoading}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Smart Playlist Discovery automatically identifies the channel &amp; complete course playlist from a single video link, verifies membership, and imports every lesson in order.
            </p>

            {/* Loading animation while searching playlists */}
            {isDetectingUrl && (
              <div
                data-testid="playlist-searching-indicator"
                className="mt-2.5 px-3.5 py-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs flex items-center gap-2.5"
              >
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                <div>
                  <div className="font-semibold text-indigo-900">
                    Smart Playlist Discovery in progress...
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    Extracting video ID, querying channel playlists &amp; verifying video membership...
                  </div>
                </div>
              </div>
            )}

            {/* Multiple Playlists Selection List (Scenario C) */}
            {!isDetectingUrl &&
              discoveryResult?.status === 'multiple_playlists_found' &&
              Array.isArray(discoveryResult.candidates) &&
              discoveryResult.candidates.length > 1 && (
                <div
                  data-testid="multiple-playlists-selector"
                  className="mt-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-700" />
                      Multiple Matching Playlists Found ({discoveryResult.candidates.length})
                    </span>
                    <span className="text-[11px] text-amber-700 font-medium">
                      Select the playlist to import
                    </span>
                  </div>
                  <div className="space-y-2">
                    {discoveryResult.candidates.map(cand => {
                      const isSelected = selectedCandidate?.playlistId === cand.playlistId;
                      return (
                        <button
                          key={cand.playlistId}
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(cand);
                            if (!userEditedTopic) {
                              setCourseTopic(cand.title);
                            }
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white/70 border-amber-200 hover:border-indigo-300'
                          }`}
                        >
                          <img
                            src={cand.thumbnail}
                            alt={cand.title}
                            className="w-16 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {cand.title}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                              <span>{cand.channelTitle}</span>
                              <span>·</span>
                              <span className="font-semibold text-indigo-700">
                                {cand.itemCount} lessons
                              </span>
                              <span>·</span>
                              <span className="text-emerald-700 font-mono">
                                {cand.relevanceScore}% match
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'border border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Playlist Preview Card (Scenarios A, B, C, E) */}
            {!isDetectingUrl && selectedCandidate && selectedCandidate.lessons.length >= 2 && (
              <div
                data-testid="playlist-preview-card"
                className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={selectedCandidate.thumbnail}
                    alt={selectedCandidate.title}
                    className="w-20 h-13 object-cover rounded-lg border border-emerald-200 shrink-0 bg-slate-100"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified Playlist Ready to Import
                      </span>
                      <span className="text-[11px] font-bold font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {selectedCandidate.itemCount} Lessons
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {selectedCandidate.title}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Channel: <strong>{selectedCandidate.channelTitle}</strong> · Every lesson has a unique video ID &amp; sequential order
                    </div>
                  </div>
                </div>

                {/* Preview first 4 sequential lessons to confirm unique video IDs */}
                <div className="bg-white/90 rounded-lg border border-emerald-200/80 p-2 space-y-1 max-h-28 overflow-y-auto">
                  {selectedCandidate.lessons.slice(0, 5).map(les => (
                    <div
                      key={les.videoId}
                      className="flex items-center justify-between text-[11px] text-slate-700 gap-2"
                    >
                      <span className="truncate">
                        <strong className="font-mono text-indigo-700">
                          #{les.playlistPosition}
                        </strong>{' '}
                        {les.title}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        id:{les.videoId}
                      </span>
                    </div>
                  ))}
                  {selectedCandidate.lessons.length > 5 && (
                    <div className="text-[10px] text-slate-500 font-medium pt-0.5">
                      + {selectedCandidate.lessons.length - 5} more sequential lessons ready to import...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback Mechanism when original playlist cannot be discovered (Scenario D) */}
            {!isDetectingUrl && discoveryResult?.status === 'no_playlist_found' && (
              <div
                data-testid="playlist-fallback-panel"
                className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3"
              >
                <div className="flex items-start gap-2 text-amber-900 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{PLAYLIST_FALLBACK_MESSAGE}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFallbackMode('direct_playlist')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      fallbackMode === 'direct_playlist'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Direct Playlist URL Import
                  </button>
                  <button
                    type="button"
                    onClick={() => setFallbackMode('manual_multi_video')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      fallbackMode === 'manual_multi_video'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ListVideo className="w-3.5 h-3.5" />
                    Manual Multiple-Video URLs
                  </button>
                </div>

                {fallbackMode === 'direct_playlist' ? (
                  <div className="text-[11px] text-amber-800 bg-white/80 p-2.5 rounded-lg border border-amber-200/80">
                    Copy the full playlist URL from YouTube (containing{' '}
                    <code className="font-mono font-bold">?list=PL...</code>) and paste it in the URL field above.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Paste Multiple YouTube Video URLs (one URL per line, in lesson order):
                    </label>
                    <textarea
                      rows={4}
                      value={manualVideoUrlsText}
                      onChange={e => setManualVideoUrlsText(e.target.value)}
                      placeholder={
                        'https://www.youtube.com/watch?v=kBdlM6hNDAE\nhttps://www.youtube.com/watch?v=3EJlovevfcA\nhttps://www.youtube.com/watch?v=pDX4NR4eQf3'
                      }
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-slate-900"
                    />
                    <p className="text-[10px] text-slate-500">
                      Each lesson will be assigned its own unique videoId, title, thumbnail, and playlist position. Duplicate video IDs are automatically removed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Course Title / Subject Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Name or Subject (Optional — auto-detected from YouTube URL if left blank)
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={courseTopic}
                onChange={e => {
                  setCourseTopic(e.target.value);
                  setUserEditedTopic(true);
                }}
                placeholder="e.g. DBMS, Operating Systems, Python Full Course"
                className="w-full text-xs pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Preset fast picks */}
          <div>
            <span className="block text-xs text-slate-500 mb-2">Or auto-fill a popular study track:</span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_COURSE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => handleSelectQuickTemplate(tpl)}
                  className="px-2.5 py-1 text-xs border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 rounded-lg text-slate-700 transition-colors cursor-pointer text-left"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Flexible Pacing Presets for Universal Learners */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Flexible Pacing Preset (After-Office Hours, Weekend Sprint, or Daily):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PACING_PRESETS.map(preset => (
                <button
                  key={preset.mode}
                  type="button"
                  onClick={() => {
                    setDailyMinutes(preset.dailyMinutesTarget);
                    setScheduledTime(preset.preferredTime);
                    setSelectedDays([...preset.studyDays]);
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 rounded-lg text-slate-700 transition-colors cursor-pointer"
                >
                  {preset.label} ({preset.dailyMinutesTarget}m)
                </button>
              ))}
            </div>
          </div>

          {/* Daily Commitment Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Daily Study Time Commitment</span>
              </label>
              <span className="text-xs font-bold font-mono tabular-nums text-indigo-600">
                {dailyMinutes} Minutes / day
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              step={15}
              value={dailyMinutes}
              onChange={e => setDailyMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
              <span>30m (After-Work)</span>
              <span>60m (Standard)</span>
              <span>120m+ (Weekend/Sprint)</span>
            </div>
          </div>

          {/* Scheduled Timing Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              When are you free to study daily? (Session Alert Time)
            </label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              disabled={isLoading}
            />
            <span className="text-xs text-slate-500 ml-2">
              (DevTrack will chime and alert you at this exact time)
            </span>
          </div>

          {/* Study Days Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Active Study Days</span>
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {dayLabels.map((label, idx) => {
                const isSelected = selectedDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Import progress bar & loading status */}
          {isLoading && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2 text-xs text-indigo-700">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  {loadingStep || 'Importing playlist lessons...'}
                </span>
                <span className="font-mono font-bold">{importProgressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${Math.max(10, importProgressPercent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing Course...</span>
                </>
              ) : selectedCandidate ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm &amp; Import {selectedCandidate.itemCount} Lessons</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Build My Personalized Tracker</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
