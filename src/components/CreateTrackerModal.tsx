import React, { useState, useEffect } from 'react';
import { X, Sparkles, Youtube, Clock, Calendar, Check, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { Tracker } from '../types';
import {
  buildDynamicTrackerFromInput,
  fetchYouTubeMetadataClientSide,
  parseYouTubeSourceUrl,
  PACING_PRESETS,
} from '../utils/studyWorkspaceLogic';

interface CreateTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTracker: (newTracker: Tracker) => void;
}

const POPULAR_COURSE_TEMPLATES = [
  {
    label: 'DBMS Complete Playlist',
    topic: 'DBMS (Database Management Systems)',
    url: 'https://www.youtube.com/watch?v=kBdlM6hNDAE&list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y',
  },
  {
    label: 'Operating Systems (OS)',
    topic: 'Operating Systems (OS) Complete Course',
    url: 'https://www.youtube.com/watch?v=bkSWJJZNgf8&list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p',
  },
  {
    label: 'Python Full Course',
    topic: 'Python Programming & Automation Mastery',
    url: 'https://www.youtube.com/playlist?list=PLu0W_9lII9agwh1XjRt242xIpHhPT2llg',
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

export const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
  isOpen,
  onClose,
  onSaveTracker,
}) => {
  const [courseTopic, setCourseTopic] = useState('');
  const [userEditedTopic, setUserEditedTopic] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [detectedMeta, setDetectedMeta] = useState<{
    title: string;
    instructor: string;
    category: string;
  } | null>(null);
  const [isDetectingUrl, setIsDetectingUrl] = useState(false);
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [scheduledTime, setScheduledTime] = useState<string>('20:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon-Sat
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');

  // Auto-detect course title, instructor, and category whenever user pastes/types a YouTube URL
  useEffect(() => {
    const trimmed = inputUrl.trim();
    const parsed = parseYouTubeSourceUrl(trimmed);
    if (!parsed.isYouTube) {
      setDetectedMeta(null);
      setIsDetectingUrl(false);
      return;
    }

    let cancelled = false;
    setIsDetectingUrl(true);

    const timer = setTimeout(async () => {
      const meta = await fetchYouTubeMetadataClientSide(trimmed);
      if (cancelled) return;
      setIsDetectingUrl(false);
      if (meta) {
        setDetectedMeta(meta);
        if (!userEditedTopic && !courseTopic.trim()) {
          setCourseTopic(meta.title);
        }
      }
    }, 250);

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
  };

  const resetAndClose = () => {
    setCourseTopic('');
    setUserEditedTopic(false);
    setInputUrl('');
    setDetectedMeta(null);
    setErrorMsg(null);
    setIsLoading(false);
    onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = inputUrl.trim();
    const trimmedTopic = courseTopic.trim();

    if (!trimmedUrl && !trimmedTopic) {
      setErrorMsg('Please enter a YouTube playlist/video link or a course topic.');
      return;
    }

    const effectiveUrl = trimmedUrl || trimmedTopic;
    const effectiveTopic = trimmedTopic || detectedMeta?.title || '';
    const uniqueTrackerId = `tracker-${Date.now()}`;

    setErrorMsg(null);
    setIsLoading(true);
    setLoadingStep('Auto-detecting YouTube lectures & binding sequential lesson URLs...');

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
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setLoadingStep('Structuring day-by-day modules, exercises, and YouTube links...');

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract syllabus');
      }

      // Build and normalize the new Tracker so all headers, tags, and lessons reflect the selected subject and YouTube playlist
      const newTracker = buildDynamicTrackerFromInput({
        inputUrl: effectiveUrl,
        rawTopic: effectiveTopic,
        extractedData: result.data,
        dailyMinutes,
        scheduledTime,
        studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
        trackerId: uniqueTrackerId,
      });

      onSaveTracker(newTracker);
      resetAndClose();
    } catch (err: any) {
      console.warn('Building dynamic course tracker with client-side YouTube parser:', err?.message || err);

      const clientMeta = detectedMeta || (await fetchYouTubeMetadataClientSide(effectiveUrl));

      // Dynamic curriculum builder: NEVER copies pre-completed Striver DSA lessons for non-DSA courses
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
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Resource URL input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              YouTube Playlist Link or Video URL
            </label>
            <div className="relative">
              <Youtube className="w-4 h-4 text-rose-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="Paste YouTube link e.g. https://www.youtube.com/playlist?list=..."
                className="w-full text-xs pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                disabled={isLoading}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Paste any YouTube playlist or lecture URL — DevTrack auto-detects the subject, lectures, and binds each lesson to its own video index.
            </p>
            {(isDetectingUrl || detectedMeta) && (
              <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between gap-2">
                {isDetectingUrl ? (
                  <span className="text-emerald-700 flex items-center gap-1.5 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Auto-detecting YouTube course metadata...
                  </span>
                ) : (
                  detectedMeta && (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-emerald-900">
                        Detected: {detectedMeta.title}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Category: <strong>{detectedMeta.category}</strong> · Source: <strong>{detectedMeta.instructor}</strong>
                      </div>
                    </div>
                  )
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

          {/* Loading status */}
          {isLoading && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-xs text-indigo-700">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{loadingStep || 'Processing course curriculum...'}</span>
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
                  <span>Generating Tracker...</span>
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
