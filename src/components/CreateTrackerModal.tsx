import React, { useState } from 'react';
import { X, Sparkles, Youtube, Clock, Calendar, Check, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { Tracker } from '../types';
import { PRESET_TRACKERS } from '../utils/mockPresets';
import { buildDynamicTrackerFromInput } from '../utils/studyWorkspaceLogic';

interface CreateTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTracker: (newTracker: Tracker) => void;
}

const POPULAR_COURSE_TEMPLATES = [
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
  {
    label: 'Machine Learning & AI',
    topic: 'Applied Machine Learning & AI Engineering',
    url: 'https://www.youtube.com/playlist?list=PLZoTAELRMXVPBTrWtJkn3wWQxZkmTXGwe',
  },
];

export const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
  isOpen,
  onClose,
  onSaveTracker,
}) => {
  const [courseTopic, setCourseTopic] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [scheduledTime, setScheduledTime] = useState<string>('20:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon-Sat
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');

  if (!isOpen) return null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSelectQuickTemplate = (tpl: { label: string; topic: string; url: string }) => {
    setCourseTopic(tpl.topic);
    setInputUrl(tpl.url);
    setErrorMsg(null);
  };

  const resetAndClose = () => {
    setCourseTopic('');
    setInputUrl('');
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
    const effectiveTopic = trimmedTopic || trimmedUrl;
    const uniqueTrackerId = `tracker-${Date.now()}`;

    setErrorMsg(null);
    setIsLoading(true);
    setLoadingStep('Extracting course syllabus & binding YouTube lectures...');

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

      // Build and normalize the new Tracker so all lessons start at 0% and bind to effectiveUrl
      const newTracker = buildDynamicTrackerFromInput({
        inputUrl: effectiveUrl,
        rawTopic: trimmedTopic || result.data.title || effectiveTopic,
        extractedData: result.data,
        dailyMinutes,
        scheduledTime,
        studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
        trackerId: uniqueTrackerId,
      });

      onSaveTracker(newTracker);
      resetAndClose();
    } catch (err: any) {
      console.warn('Building dynamic course tracker locally:', err?.message || err);

      // Dynamic curriculum builder: NEVER copies pre-completed Striver DSA lessons for non-DSA courses
      const dynamicTracker = buildDynamicTrackerFromInput({
        inputUrl: effectiveUrl,
        rawTopic: effectiveTopic,
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
          {/* Course Title / Subject Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Name or Subject (e.g., &quot;Python Full Course&quot;, &quot;React 19&quot;, &quot;System Design&quot;)
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={courseTopic}
                onChange={e => setCourseTopic(e.target.value)}
                placeholder="e.g. Python Programming Full Course for Beginners"
                className="w-full text-xs pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                disabled={isLoading}
              />
            </div>
          </div>

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
              All lesson video buttons in your new course will dynamically bind to this YouTube URL.
            </p>
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
              <span>30m (Quick)</span>
              <span>60m (Standard)</span>
              <span>120m+ (Intensive)</span>
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
