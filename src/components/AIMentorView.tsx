import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Brain,
  CheckCircle,
  HelpCircle,
  Code2,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Send,
  Loader2,
  Database,
  History,
  RotateCw,
  Zap,
  Compass,
  ListOrdered,
  Clock,
  Layers,
  ShieldAlert,
  BookOpen,
  GraduationCap,
  Briefcase,
  Terminal
} from 'lucide-react';
import { Tracker, Lesson, AIRecapData, ConceptTutorAnswer } from '../types';
import { aiMentorStorage, buildSmartConceptFallback } from '../utils/aiMentorCache';
import { buildDefaultRecapForTracker } from '../utils/studyWorkspaceLogic';

interface AIMentorViewProps {
  tracker: Tracker;
  streakDays: number;
}

export const AIMentorView: React.FC<AIMentorViewProps> = ({ tracker, streakDays }) => {
  // Find completed lessons
  const completedLessons: Lesson[] = React.useMemo(() => {
    const list: Lesson[] = [];
    tracker.modules.forEach(m => {
      m.lessons.forEach(l => {
        if (l.completed) list.push(l);
      });
    });
    return list;
  }, [tracker]);

  // Current lesson in progress
  const currentLesson: Lesson = React.useMemo(() => {
    for (const m of tracker.modules) {
      for (const l of m.lessons) {
        if (!l.completed) return l;
      }
    }
    return tracker.modules[0]?.lessons[0];
  }, [tracker]);

  // Completed signature for caching daily recap
  const completedSignature = React.useMemo(() => {
    return completedLessons.map(l => l.id).join('-');
  }, [completedLessons]);

  // Recap State initialized dynamically for the active course (never hardcoded DSA when on another subject)
  const [recapData, setRecapData] = useState<AIRecapData>(() => {
    const cached = aiMentorStorage.getDailyRecap(tracker.title, completedSignature);
    if (cached) return cached;
    return buildDefaultRecapForTracker(tracker, streakDays);
  });

  const [isLoadingRecap, setIsLoadingRecap] = useState<boolean>(false);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});

  // Tutor State with localStorage cache integration & explanation style
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [explanationStyle, setExplanationStyle] = useState<'simple' | 'interview'>('simple');
  const [isLoadingTutor, setIsLoadingTutor] = useState<boolean>(false);
  const [tutorAnswer, setTutorAnswer] = useState<ConceptTutorAnswer | null>(null);
  const [isCachedResult, setIsCachedResult] = useState<boolean>(false);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [quizSelection, setQuizSelection] = useState<number | null>(null);
  const [hasAnsweredQuiz, setHasAnsweredQuiz] = useState<boolean>(false);
  const [previousDoubts, setPreviousDoubts] = useState<Array<{ question: string; timestamp: number }>>([]);

  // Dynamic lesson-tailored quick doubt chips adapted to Professor Mode vs Interviewer Mode
  const quickDoubtChips = React.useMemo(() => {
    const concepts = currentLesson?.keyConcepts || [];
    const firstConcept = concepts[0] || currentLesson?.title || 'this topic';
    const secondConcept = concepts[1] || 'time complexity';

    if (explanationStyle === 'interview') {
      return [
        `What do interviewers actually ask on ${firstConcept} & what answer do they expect?`,
        `Give me optimal interview code for ${firstConcept} & explain each line of code`,
        `What are the follow-up trap questions and edge cases on ${currentLesson?.title || 'this topic'}?`,
        `How to explain brute-force vs optimal ${secondConcept} in an interview?`,
      ];
    }

    return [
      `Teach me ${firstConcept} like I am a beginner with a real-world example`,
      `Walk me through ${currentLesson?.title || 'this lesson'} step-by-step on a tiny example`,
      `Show me simple code for ${firstConcept} and explain each line of code`,
      `Why is ${secondConcept} faster than brute force in everyday words?`,
    ];
  }, [currentLesson, explanationStyle]);

  // Load previously asked doubts and reset tutor/recap state whenever active course or lesson changes
  useEffect(() => {
    const cached = aiMentorStorage.getDailyRecap(tracker.title, completedSignature);
    setRecapData(cached || buildDefaultRecapForTracker(tracker, streakDays));
    setTutorAnswer(null);
    setUserQuestion('');
    setUserCode('');
    setQuizSelection(null);
    setHasAnsweredQuiz(false);
    setRevealedHints({});
  }, [tracker.id, tracker.sourceUrl, tracker.title, completedSignature]);

  useEffect(() => {
    const list = aiMentorStorage.getPreviousQuestionsForLesson(tracker.title, currentLesson?.title || '');
    setPreviousDoubts(list.map(e => ({ question: e.question, timestamp: e.timestamp })));
  }, [tracker.title, currentLesson?.title]);

  // Generate / Refresh Recap from server Gemini API and update localStorage
  const handleRefreshRecap = async () => {
    setIsLoadingRecap(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const recent = completedLessons.slice(-4).map(l => ({
        title: l.title,
        keyConcepts: l.keyConcepts,
        notes: l.notes,
      }));

      const res = await fetch('/api/daily-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          trackerTitle: tracker.title,
          recentLessons:
            recent.length > 0
              ? recent
              : [
                  {
                    title: currentLesson?.title || tracker.title,
                    keyConcepts: currentLesson?.keyConcepts || [tracker.category],
                  },
                ],
          streak: streakDays,
          currentModule: tracker.modules[0]?.title,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setRecapData(data.data);
        aiMentorStorage.setDailyRecap(tracker.title, completedSignature, data.data);
      }
    } catch (e) {
      console.warn('Failed to refresh AI recap:', e);
    } finally {
      clearTimeout(timeoutId);
      setIsLoadingRecap(false);
    }
  };

  // Submit Question to Concept Tutor with instant cache check & strict 6.5s client timeout
  const queryConceptTutor = async (
    questionText: string,
    codeText: string = userCode,
    forceBypassCache: boolean = false,
    styleOverride: 'simple' | 'interview' = explanationStyle
  ) => {
    const trimmedQ = questionText.trim();
    if (!trimmedQ) return;

    const lessonName = currentLesson?.title || 'Active Concept';

    // Check localStorage cache first for 0ms instantaneous results
    if (!forceBypassCache && !codeText.trim()) {
      const cached = aiMentorStorage.getConceptAnswer(tracker.title, lessonName, trimmedQ, styleOverride);
      if (cached) {
        setTutorAnswer(cached.answer);
        setIsCachedResult(true);
        setResponseTimeMs(0);
        setQuizSelection(null);
        setHasAnsweredQuiz(false);
        return;
      }
    }

    const startTick = performance.now();
    const instantAnswer = buildSmartConceptFallback(
      tracker.title,
      currentLesson,
      trimmedQ,
      tracker.category
    );
    setTutorAnswer(instantAnswer);
    setQuizSelection(null);
    setHasAnsweredQuiz(false);
    setIsCachedResult(false);
    setResponseTimeMs(Math.max(1, Math.round(performance.now() - startTick)));
    setIsLoadingTutor(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/concept-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: tracker.title,
          currentLesson: lessonName,
          question: trimmedQ,
          codeSnippet: codeText,
          explanationStyle: styleOverride,
        }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTick);

      if (data.success && data.data) {
        setTutorAnswer(data.data);
        setIsCachedResult(Boolean(data.cached));
        setResponseTimeMs(data.latencyMs ?? elapsed);
        // Persist to localStorage cache
        aiMentorStorage.setConceptAnswer(tracker.title, lessonName, trimmedQ, data.data, styleOverride);
        // Update previous doubts list
        const updatedList = aiMentorStorage.getPreviousQuestionsForLesson(tracker.title, lessonName);
        setPreviousDoubts(updatedList.map(e => ({ question: e.question, timestamp: e.timestamp })));
      } else {
        throw new Error(data.error || 'Failed to get answer');
      }
    } catch (e) {
      console.warn('Keeping instant Professor + Interviewer answer:', e);
      aiMentorStorage.setConceptAnswer(tracker.title, lessonName, trimmedQ, instantAnswer, styleOverride);
      const updatedList = aiMentorStorage.getPreviousQuestionsForLesson(tracker.title, lessonName);
      setPreviousDoubts(updatedList.map(e => ({ question: e.question, timestamp: e.timestamp })));
    } finally {
      clearTimeout(timeoutId);
      setIsLoadingTutor(false);
    }
  };

  const handleAskTutor = (e: React.FormEvent) => {
    e.preventDefault();
    queryConceptTutor(userQuestion, userCode);
  };

  const handleQuickPrompt = (promptText: string) => {
    setUserQuestion(promptText);
    queryConceptTutor(promptText, userCode);
  };

  const handleStyleSwitch = (newStyle: 'simple' | 'interview') => {
    setExplanationStyle(newStyle);
    if (userQuestion.trim() && tutorAnswer) {
      queryConceptTutor(userQuestion, userCode, false, newStyle);
    }
  };

  const toggleHint = (idx: number) => {
    setRevealedHints(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Helper to render the Interviewer Q&A section
  const renderInterviewSection = (ans: ConceptTutorAnswer) => {
    if (!ans.interviewPerspective) return null;
    return (
      <div className="p-5 bg-indigo-950 text-white rounded-2xl space-y-4 border border-indigo-800 shadow-sm">
        <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Real Technical Interview Section (What Interviewers Ask &amp; Expect)
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-900 text-indigo-200 rounded-full border border-indigo-700">
            FAANG / Tech Interview Ready
          </span>
        </div>

        {/* 1. Actual Question Asked by Interviewer */}
        <div className="p-3.5 bg-indigo-900/70 border border-indigo-800 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide block">
            1. What the Interviewer Actually Asks:
          </span>
          <p className="text-xs font-semibold text-white leading-relaxed">
            {ans.interviewPerspective.actualInterviewQuestion}
          </p>
        </div>

        {/* 2. What Interviewer Expects You to Answer */}
        <div className="p-3.5 bg-indigo-900/40 border border-indigo-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide block">
            2. Exact Answer &amp; Approach the Interviewer Expects:
          </span>
          <p className="text-xs text-indigo-100 leading-relaxed">
            {ans.interviewPerspective.whatInterviewerExpects}
          </p>
        </div>

        {/* 3. Follow-Up Trap Question */}
        {ans.interviewPerspective.followUpTrap && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-400/30 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide block">
              3. Classic Follow-Up Question to Watch Out For:
            </span>
            <p className="text-xs text-amber-100 leading-relaxed">
              {ans.interviewPerspective.followUpTrap}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>Professor-Style Concept Mentor &amp; Technical Interview Coach</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Learn Like a Beginner with a Professor, Answer Like a Pro in Interviews
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Every doubt is cleared with a relatable real-world example, a beginner-friendly step-by-step whiteboard walkthrough, actual interviewer questions &amp; expected answers, and line-by-line code explanations.
          </p>
        </div>

        {/* Source Transparency & Next-Step Guidance Banner */}
        <div
          data-testid="mentor-transparency-banner"
          className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
        >
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="font-bold text-indigo-700">Verified Course Metadata</span>
              <span aria-hidden="true">·</span>
              <span>{tracker.title}</span>
              <span aria-hidden="true">·</span>
              <span>Instructor: {tracker.instructor}</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>AI Transparency Notice:</strong> Concept explanations, code walkthroughs, and interview questions are generated from your verified course syllabus metadata (<strong>{currentLesson?.title || tracker.title}</strong>) and core subject knowledge. The assistant does not claim access to full private video transcripts.
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Recommended Focus Lecture:</span>
            <span className="font-bold text-slate-900">
              {currentLesson?.title || tracker.modules[0]?.lessons[0]?.title || tracker.title}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
              {completedLessons.length} lectures completed · {streakDays}d streak
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: 1-on-1 Concept Tutor & Doubt Clearance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                1-on-1 Professor &amp; Interview Mentor
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full inline-flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>Fast ~2.5s Response</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Current Lesson: <strong className="text-slate-800">{currentLesson?.title || tracker.title}</strong>
            </p>
          </div>

          {/* Mode Toggle: Professor Mode (Beginner) vs Interviewer Mode */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleStyleSwitch('simple')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                explanationStyle === 'simple'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Professor Mode (Beginner)</span>
            </button>
            <button
              type="button"
              onClick={() => handleStyleSwitch('interview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                explanationStyle === 'interview'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-600" />
              <span>Interviewer Mode (Q&amp;A + Code)</span>
            </button>
          </div>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleAskTutor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ask your Professor any concept or interview question:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={userQuestion}
                onChange={e => setUserQuestion(e.target.value)}
                placeholder="e.g. Why do we use a Hash Map? Or: What do interviewers ask about recursion?"
                className="flex-1 text-xs px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                disabled={isLoadingTutor}
              />
              <button
                type="submit"
                disabled={isLoadingTutor || !userQuestion.trim()}
                className="flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isLoadingTutor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Professor is explaining...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Clear My Concept</span>
                  </>
                )}
              </button>
            </div>

            {/* 1-Click Lesson-Aware Fast Concept Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>1-Click Ask Professor:</span>
              </span>
              {quickDoubtChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoadingTutor}
                  onClick={() => handleQuickPrompt(chip)}
                  className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <details className="group">
            <summary className="text-xs font-medium text-slate-500 hover:text-indigo-600 cursor-pointer list-none flex items-center gap-1.5 select-none">
              <Code2 className="w-3.5 h-3.5" />
              <span>+ Paste your own code to get a line-by-line Professor explanation (optional)</span>
            </summary>
            <div className="mt-2">
              <textarea
                value={userCode}
                onChange={e => setUserCode(e.target.value)}
                placeholder="Paste your code here and the Professor will explain each line in plain English..."
                rows={3}
                className="w-full font-mono text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50/40"
                disabled={isLoadingTutor}
              />
            </div>
          </details>

          {/* Previously Cached Doubts for Instant 0ms Recall */}
          {previousDoubts.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold flex items-center gap-1">
                  <History className="w-3 h-3 text-slate-400" />
                  <span>Previously Cleared Concepts (Instant 0ms):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    aiMentorStorage.clearAllMentorCache();
                    setPreviousDoubts([]);
                    setTutorAnswer(null);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previousDoubts.slice(0, 5).map((doubt, dIdx) => (
                  <button
                    key={dIdx}
                    type="button"
                    onClick={() => {
                      setUserQuestion(doubt.question);
                      queryConceptTutor(doubt.question);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-left"
                  >
                    <Database className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[220px] sm:max-w-xs">{doubt.question}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Real-Time Fast Loading Card */}
        {isLoadingTutor && (
          <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-3.5 text-xs text-indigo-900 animate-pulse">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
            <div>
              <strong className="block font-semibold">
                {explanationStyle === 'interview'
                  ? 'Preparing actual interviewer questions, expected answers, and line-by-line optimal code...'
                  : 'Your Professor is preparing a real-world example, beginner step-by-step walkthrough, and line-by-line code explanation...'}
              </strong>
              <span className="text-indigo-700 text-[11px]">
                {explanationStyle === 'interview'
                  ? 'Tailored to what technical interviewers ask and expect you to explain.'
                  : 'Designed for a beginner student to understand on the very first read.'}
              </span>
            </div>
          </div>
        )}

        {/* Tutor Response Card */}
        {tutorAnswer && (
          <div className="mt-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-6">
            {/* Top Bar: Header + Speed Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                {explanationStyle === 'interview' ? (
                  <Briefcase className="w-4 h-4 text-amber-600" />
                ) : (
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                )}
                <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-600">
                  {explanationStyle === 'interview'
                    ? 'Technical Interviewer Answer & Code Walkthrough'
                    : 'Professor’s Direct Explanation (Beginner Friendly)'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                  {explanationStyle === 'simple' ? 'Professor Mode' : 'Interviewer Mode'}
                </span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {responseTimeMs !== null && (
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>
                      {isCachedResult || responseTimeMs === 0
                        ? 'Instant (0ms cache)'
                        : `${(responseTimeMs / 1000).toFixed(1)}s`}
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => queryConceptTutor(userQuestion, userCode, true)}
                  className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer font-medium px-2 py-0.5 rounded hover:bg-white"
                  title="Regenerate fresh explanation"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>

            {/* 1. Professor's Direct Plain-English Answer */}
            <div className="p-4 bg-white border border-indigo-100 rounded-xl shadow-2xs">
              <p className="text-sm font-bold text-slate-900 leading-relaxed">
                {tutorAnswer.directAnswer}
              </p>
            </div>

            {/* 2. Concrete Real-World Example (Always shown right below the direct answer) */}
            {tutorAnswer.realWorldAnalogy && (
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3">
                <Compass className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <strong className="text-amber-950 font-extrabold block uppercase tracking-wide text-[11px]">
                    Real-World Example (Imagine This in Everyday Life)
                  </strong>
                  <p className="text-amber-950 leading-relaxed font-medium">
                    {tutorAnswer.realWorldAnalogy}
                  </p>
                </div>
              </div>
            )}

            {/* If Interviewer Mode is selected, promote the Interview Q&A Section right here */}
            {explanationStyle === 'interview' && renderInterviewSection(tutorAnswer)}

            {/* 3. Professor's Step-by-Step Whiteboard Breakdown */}
            {tutorAnswer.stepByStepBreakdown && tutorAnswer.stepByStepBreakdown.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-indigo-600" />
                  <span>
                    {explanationStyle === 'interview'
                      ? 'Step-by-Step Optimal Interview Approach:'
                      : 'Step-by-Step Whiteboard Walkthrough (For Beginners):'}
                  </span>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {tutorAnswer.stepByStepBreakdown.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-700"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Code Implementation + Line-by-Line Code Explanation */}
            {tutorAnswer.codeExample && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-slate-900">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    <span>Code Implementation ({tutorAnswer.codeExample.language})</span>
                  </span>
                  <span className="text-slate-600 font-medium">{tutorAnswer.codeExample.explanation}</span>
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{tutorAnswer.codeExample.code}</code>
                </pre>

                {/* Line-by-Line Explanation of the Code */}
                {tutorAnswer.codeExample.lineByLine && tutorAnswer.codeExample.lineByLine.length > 0 && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-indigo-600" />
                      <span>Line-by-Line Code Explanation (What Each Line Does):</span>
                    </span>
                    <div className="divide-y divide-slate-100">
                      {tutorAnswer.codeExample.lineByLine.map((item, lIdx) => (
                        <div
                          key={lIdx}
                          className="py-2.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-baseline gap-2 text-xs"
                        >
                          <code className="font-mono text-[11px] bg-slate-900 text-emerald-300 px-2.5 py-1 rounded-md shrink-0 sm:w-64 overflow-x-auto">
                            {item.line}
                          </code>
                          <span className="text-slate-700 leading-relaxed">
                            <strong className="text-indigo-600 mr-1">&rarr;</strong>
                            {item.explanation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Simple Time & Space Complexity + #1 Beginner Mistake */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200 pt-4">
              {tutorAnswer.complexitySimple && (
                <>
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block mb-0.5">Speed (Time Complexity)</strong>
                      <span className="text-slate-600 leading-relaxed">
                        {tutorAnswer.complexitySimple.time}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs">
                    <Layers className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block mb-0.5">Memory (Space Complexity)</strong>
                      <span className="text-slate-600 leading-relaxed">
                        {tutorAnswer.complexitySimple.space}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {tutorAnswer.commonMistake && (
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-950 font-bold block mb-0.5">
                    Professor’s Warning (#1 Beginner Mistake to Avoid):
                  </strong>
                  <span className="text-rose-900 leading-relaxed">
                    {tutorAnswer.commonMistake}
                  </span>
                </div>
              </div>
            )}

            {/* Detailed Summary */}
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line border-t border-slate-200 pt-3">
              <strong className="text-slate-900 block mb-1">Professor’s Final Summary:</strong>
              {tutorAnswer.detailedExplanation}
            </div>

            {/* 6. Quick Check Quiz */}
            {tutorAnswer.quickCheckQuestion && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Quick 10-Second Concept Check:</span>
                </span>
                <p className="text-xs font-medium text-slate-800">
                  {tutorAnswer.quickCheckQuestion.question}
                </p>
                <div className="space-y-2">
                  {tutorAnswer.quickCheckQuestion.options.map((option, optIdx) => {
                    const isSelected = quizSelection === optIdx;
                    const isCorrect = optIdx === tutorAnswer.quickCheckQuestion?.correctIndex;

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setQuizSelection(optIdx);
                          setHasAnsweredQuiz(true);
                        }}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          hasAnsweredQuiz
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                              : isSelected
                              ? 'bg-rose-50 border-rose-300 text-rose-900 line-through'
                              : 'bg-white border-slate-200 text-slate-600'
                            : isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{option}</span>
                        {hasAnsweredQuiz && isCorrect && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {hasAnsweredQuiz && (
                  <div className="text-xs text-slate-700 p-3 bg-white border border-slate-200 rounded-xl">
                    <strong className="text-slate-900">Professor’s Feedback: </strong>
                    {tutorAnswer.quickCheckQuestion.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Previous Days Learning Recap & Practical Advice */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Previous Days' Concept Recap &amp; Practice
            </h2>
          </div>

          <button
            onClick={handleRefreshRecap}
            disabled={isLoadingRecap}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecap ? 'animate-spin' : ''}`} />
            <span>Generate Fresh Recap</span>
          </button>
        </div>

        {/* Synthesis Text */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <span className="text-xs font-semibold text-slate-700 block">
            What You Learned Recently (In Plain English):
          </span>
          <p className="text-xs text-slate-700 leading-relaxed">
            {recapData.summary}
          </p>
        </div>

        {/* Mentor Advice Banner */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="text-indigo-950 block mb-0.5">High-Impact Study Tip:</strong>
            <span className="text-indigo-900 leading-relaxed">{recapData.mentorAdvice}</span>
          </div>
        </div>

        {/* Practical Application Challenges */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Hands-On Mini Challenges (Lock In Your Understanding)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recapData.practicalChallenges.map((challenge, cIdx) => (
              <div
                key={cIdx}
                className="p-4 border border-slate-200 rounded-xl space-y-2.5 bg-white hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    {cIdx + 1}. {challenge.title}
                  </h4>
                  <span className="text-xs font-semibold text-amber-700">
                    {challenge.difficulty}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {challenge.description}
                </p>

                {/* Hint reveal */}
                <div className="pt-1">
                  {revealedHints[cIdx] ? (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900">
                      <strong>Simple Hint:</strong> {challenge.starterHint}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleHint(cIdx)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Show step-by-step hint &rarr;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Traps / Pitfalls */}
        {recapData.pitfalls && recapData.pitfalls.length > 0 && (
          <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Common Beginner Mistakes to Avoid:</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-rose-800 space-y-1">
              {recapData.pitfalls.map((pitfall, pIdx) => (
                <li key={pIdx}>{pitfall}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
