import React, { useState } from 'react';
import { X, Sparkles, Youtube, Clock, Calendar, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Tracker } from '../types';
import { PRESET_TRACKERS } from '../utils/mockPresets';

interface CreateTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTracker: (newTracker: Tracker) => void;
}

export const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
  isOpen,
  onClose,
  onSaveTracker,
}) => {
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

  const handleSelectPreset = (preset: Tracker) => {
    setInputUrl(preset.sourceUrl || preset.title);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) {
      setErrorMsg('Please enter a YouTube playlist link, video URL, or syllabus topic.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    setLoadingStep('Analyzing playlist and topics with Gemini AI...');

    try {
      const response = await fetch('/api/extract-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputUrl,
          rawTopic: inputUrl,
          dailyMinutes,
        }),
      });

      setLoadingStep('Structuring day-by-day modules and lessons...');

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract syllabus');
      }

      const extracted = result.data;

      // Construct a complete Tracker object
      const newTracker: Tracker = {
        id: `tracker-${Date.now()}`,
        title: extracted.title || 'Personalized Study Track',
        description: extracted.description || 'Structured self-study roadmap powered by DevTrack',
        category: extracted.category || 'DSA',
        difficulty: extracted.difficulty || 'Intermediate',
        instructor: extracted.instructor || 'Curated Instructor',
        sourceUrl: inputUrl,
        totalVideos: extracted.totalVideos || 16,
        estimatedTotalMinutes: extracted.estimatedTotalMinutes || 600,
        dailyMinutesTarget: dailyMinutes,
        scheduledTime: scheduledTime,
        studyDays: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6],
        createdAt: new Date().toISOString(),
        modules: (extracted.modules || []).map((mod: any, mIdx: number) => ({
          id: mod.id || `mod-${mIdx + 1}`,
          title: mod.title || `Module ${mIdx + 1}`,
          description: mod.description || '',
          lessons: (mod.lessons || []).map((les: any, lIdx: number) => ({
            id: les.id || `les-${mIdx + 1}-${lIdx + 1}`,
            title: les.title || `Lesson ${lIdx + 1}`,
            durationMinutes: les.durationMinutes || 40,
            videoUrl: les.videoUrl || inputUrl,
            keyConcepts: Array.isArray(les.keyConcepts) ? les.keyConcepts : ['Fundamentals', 'Implementation'],
            practiceTask: les.practiceTask || 'Practice core exercises on LeetCode / local repo',
            completed: false,
          })),
        })),
      };

      onSaveTracker(newTracker);
      onClose();
    } catch (err: any) {
      console.warn('Extraction fallback to high quality curated template:', err);
      // Fallback: If AI fails or user is offline, find matching preset or create a solid template
      const matchedPreset = PRESET_TRACKERS.find(p =>
        inputUrl.toLowerCase().includes('dsa') || inputUrl.toLowerCase().includes('striver')
      ) || PRESET_TRACKERS[0];

      const customFallback: Tracker = {
        ...matchedPreset,
        id: `tracker-${Date.now()}`,
        title: inputUrl.length > 50 ? `${inputUrl.slice(0, 47)}...` : inputUrl,
        dailyMinutesTarget: dailyMinutes,
        scheduledTime: scheduledTime,
        studyDays: selectedDays,
      };

      onSaveTracker(customFallback);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Create Personalized Learning Tracker
            </h2>
          </div>
          <button
            onClick={onClose}
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

        <form onSubmit={handleGenerate} className="space-y-5">
          {/* Resource URL / Topic input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              YouTube Playlist Link, Video URL, or Syllabus Topic
            </label>
            <div className="relative">
              <Youtube className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="Paste link e.g. https://youtube.com/playlist?list=... or type 'Striver DSA'"
                className="w-full text-xs pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Preset fast picks */}
          <div>
            <span className="block text-xs text-slate-500 mb-2">Or select a popular college track:</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_TRACKERS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-2.5 py-1 text-xs border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer text-left"
                >
                  {preset.title.split(':')[0]}
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
              <span>{loadingStep || 'Processing with AI...'}</span>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
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
