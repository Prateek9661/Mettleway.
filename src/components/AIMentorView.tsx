import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, CheckCircle, HelpCircle, Code2, AlertTriangle, Lightbulb, RefreshCw, Send, Loader2, Database, History, RotateCw } from 'lucide-react';
import { Tracker, Lesson, AIRecapData, ConceptTutorAnswer } from '../types';
import { aiMentorStorage } from '../utils/aiMentorCache';

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

  // Recap State initialized from localStorage if available
  const [recapData, setRecapData] = useState<AIRecapData>(() => {
    const cached = aiMentorStorage.getDailyRecap(tracker.title, completedSignature);
    if (cached) return cached;
    return {
      summary: `Over the past ${Math.max(streakDays, 2)} days, you've focused on foundational complexity analysis and recursive paradigms. Understanding that Big-O abstracts away hardware constants allows you to accurately predict scale. Recursion relies directly on the operating system's call stack—each call allocates a stack frame until the base case returns.`,
      practicalChallenges: [
        {
          title: "Recursive Array Reversal with Two Pointers",
          difficulty: "Easy",
          description: "Write a function reverseArray(arr, left, right) that reverses an array in-place using recursion without any auxiliary array.",
          starterHint: "Base case is left >= right. Swap arr[left] with arr[right], then recurse with left+1, right-1.",
        },
        {
          title: "Frequency Counting for Non-Consecutive Anagrams",
          difficulty: "Medium",
          description: "Given two strings s and t, determine if t is an anagram of s in O(N) time and O(1) extra space (26 alphabet characters).",
          starterHint: "Increment counts for string s, decrement counts for string t in an array of size 26. Verify all counts return to zero.",
        },
      ],
      pitfalls: [
        "Forgetting the recursive base case leads to fatal stack overflow (Segmentation Fault in C++).",
        "Using an ordered map (std::map) introduces O(log N) overhead per lookup instead of O(1) amortized in unordered_map.",
      ],
      mentorAdvice: "When studying DSA, don't just watch the video passively. Write the code from memory on LeetCode within 30 minutes of watching to cement neural pathways.",
    };
  });

  const [isLoadingRecap, setIsLoadingRecap] = useState<boolean>(false);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});

  // Tutor State with localStorage cache integration
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [isLoadingTutor, setIsLoadingTutor] = useState<boolean>(false);
  const [tutorAnswer, setTutorAnswer] = useState<ConceptTutorAnswer | null>(null);
  const [isCachedResult, setIsCachedResult] = useState<boolean>(false);
  const [cachedTimestamp, setCachedTimestamp] = useState<number | null>(null);
  const [quizSelection, setQuizSelection] = useState<number | null>(null);
  const [hasAnsweredQuiz, setHasAnsweredQuiz] = useState<boolean>(false);
  const [previousDoubts, setPreviousDoubts] = useState<Array<{ question: string; timestamp: number }>>([]);

  // Load previously asked doubts from localStorage whenever lesson changes
  useEffect(() => {
    const list = aiMentorStorage.getPreviousQuestionsForLesson(tracker.title, currentLesson?.title || '');
    setPreviousDoubts(list.map(e => ({ question: e.question, timestamp: e.timestamp })));
  }, [tracker.title, currentLesson?.title]);

  // Generate / Refresh Recap from server Gemini API and update localStorage
  const handleRefreshRecap = async () => {
    setIsLoadingRecap(true);
    try {
      const recent = completedLessons.slice(-4).map(l => ({
        title: l.title,
        keyConcepts: l.keyConcepts,
        notes: l.notes,
      }));

      const res = await fetch('/api/daily-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackerTitle: tracker.title,
          recentLessons: recent.length > 0 ? recent : [{ title: 'Foundations & Complexity', keyConcepts: ['Big-O', 'Recursion'] }],
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
      setIsLoadingRecap(false);
    }
  };

  // Submit Question to Concept Tutor with localStorage check
  const queryConceptTutor = async (questionText: string, codeText: string = userCode, forceBypassCache: boolean = false) => {
    const trimmedQ = questionText.trim();
    if (!trimmedQ) return;

    // Check localStorage cache first for 0ms instantaneous results
    if (!forceBypassCache) {
      const cached = aiMentorStorage.getConceptAnswer(tracker.title, currentLesson?.title || 'Active Concept', trimmedQ);
      if (cached) {
        setTutorAnswer(cached.answer);
        setIsCachedResult(true);
        setCachedTimestamp(cached.timestamp);
        setQuizSelection(null);
        setHasAnsweredQuiz(false);
        return;
      }
    }

    setIsLoadingTutor(true);
    setTutorAnswer(null);
    setQuizSelection(null);
    setHasAnsweredQuiz(false);
    setIsCachedResult(false);
    setCachedTimestamp(null);

    try {
      const res = await fetch('/api/concept-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: tracker.title,
          currentLesson: currentLesson?.title || 'Active Concept',
          question: trimmedQ,
          codeSnippet: codeText,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setTutorAnswer(data.data);
        setIsCachedResult(false);
        // Persist to localStorage cache
        aiMentorStorage.setConceptAnswer(tracker.title, currentLesson?.title || 'Active Concept', trimmedQ, data.data);
        // Update previous doubts list
        const updatedList = aiMentorStorage.getPreviousQuestionsForLesson(tracker.title, currentLesson?.title || '');
        setPreviousDoubts(updatedList.map(e => ({ question: e.question, timestamp: e.timestamp })));
      } else {
        throw new Error(data.error || 'Failed to get answer');
      }
    } catch (e) {
      console.warn('Fallback to local pedagogical tutor:', e);
      const fallbackData: ConceptTutorAnswer = {
        directAnswer: `In ${tracker.category}, "${trimmedQ}" balances operational time and memory constraints.`,
        detailedExplanation: `When tackling **${trimmedQ}**, the core insight is:
1. **State Definition**: Identify the unique invariant parameters.
2. **Asymptotic Complexity**: Time is proportional to input size, while space depends on auxiliary variables.
3. **Corner Cases**: Always verify empty, single-element, and duplicate inputs.`,
        codeExample: {
          language: tracker.category === 'DSA' ? 'cpp' : 'javascript',
          code: `// High-performance pattern\nvoid solve() {\n  int left = 0, right = n - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n  }\n}`,
          explanation: "Using (right - left) / 2 prevents 32-bit integer overflow.",
        },
        quickCheckQuestion: {
          question: "Why does integer division left + (right - left) / 2 avoid bugs in Binary Search?",
          options: [
            "It executes in O(1) instead of O(log N)",
            "Prevents signed 32-bit integer overflow when left + right > 2^31 - 1",
            "It reverses the binary bits automatically",
            "It is required by the C++ compiler",
          ],
          correctIndex: 1,
          explanation: "Correct! If left and right are both large, (left + right) overflows signed 32-bit integer limits.",
        },
      };
      setTutorAnswer(fallbackData);
      aiMentorStorage.setConceptAnswer(tracker.title, currentLesson?.title || 'Active Concept', trimmedQ, fallbackData);
    } finally {
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

  const toggleHint = (idx: number) => {
    setRevealedHints(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
          <Sparkles className="w-4 h-4" />
          <span>AI Concept Mentor & Daily Synthesizer</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Learn Smarter, Retain 10x Longer
        </h1>
        <p className="text-xs text-slate-600 mt-1 max-w-2xl">
          DevTrack's AI analyzes what you covered in previous days, suggests hands-on LeetCode/project exercises, and clarifies your doubts on demand.
        </p>
      </div>

      {/* Section 1: Previous Days Learning Recap & Practical Advice */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Previous Days' Concept Recap & Retention
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
            What You Learned & Why It Matters:
          </span>
          <p className="text-xs text-slate-700 leading-relaxed">
            {recapData.summary}
          </p>
        </div>

        {/* Mentor Advice Banner */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="text-indigo-950 block mb-0.5">High-Impact Study Advice:</strong>
            <span className="text-indigo-900 leading-relaxed">{recapData.mentorAdvice}</span>
          </div>
        </div>

        {/* Practical Application Challenges */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Practical Application Challenges (Put Knowledge to Work)
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
                      <strong>Starter Hint:</strong> {challenge.starterHint}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleHint(cIdx)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Show approach hint &rarr;
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
              <span>Common Beginner Traps & Interview Pitfalls to Avoid:</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-rose-800 space-y-1">
              {recapData.pitfalls.map((pitfall, pIdx) => (
                <li key={pIdx}>{pitfall}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Section 2: 1-on-1 Concept Tutor & Doubt Clearance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              1-on-1 Concept Tutor & Doubt Clearance
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stuck on a lesson or video concept? Ask anything to get an intuitive explanation, code sample, and quick check question.
          </p>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleAskTutor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Doubt or Question (Topic: {currentLesson?.title || tracker.title})
            </label>
            <div className="relative">
              <input
                type="text"
                value={userQuestion}
                onChange={e => setUserQuestion(e.target.value)}
                placeholder="e.g. Why does Dutch National Flag use 3 pointers? Or: What is space complexity of recursion?"
                className="w-full text-xs px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                disabled={isLoadingTutor}
              />
            </div>

            {/* 1-Click Fast Concept Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[11px] text-slate-500 font-medium">Instant queries:</span>
              {[
                "Exact time & space complexity breakdown",
                "Explain the core algorithmic invariant",
                "Step-by-step trace with example inputs",
                "Common edge cases and interview traps"
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoadingTutor}
                  onClick={() => handleQuickPrompt(chip)}
                  className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ⚡ {chip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Optional: Paste your code or snippet for context
            </label>
            <textarea
              value={userCode}
              onChange={e => setUserCode(e.target.value)}
              placeholder="Paste relevant code here if you want the AI to review or explain it..."
              rows={2}
              className="w-full font-mono text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50/40"
              disabled={isLoadingTutor}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoadingTutor || !userQuestion.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isLoadingTutor ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Solving with AI...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Explain & Clear Concept</span>
                </>
              )}
            </button>
          </div>

          {/* Previously Cached Doubts for Instant Recall */}
          {previousDoubts.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold flex items-center gap-1">
                  <History className="w-3 h-3 text-slate-400" />
                  <span>Cached Doubts for this Lesson (Instant 0ms):</span>
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
                  Clear Local Cache
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
                    <span className="truncate max-w-[200px] sm:max-w-xs">{doubt.question}</span>
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
              <strong className="block font-semibold">Generating high-precision concept answer...</strong>
              <span className="text-indigo-700 text-[11px]">Analyzing algorithmic invariant, time/space limits, and preparing code sample without delay.</span>
            </div>
          </div>
        )}

        {/* Tutor Response */}
        {tutorAnswer && (
          <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
            {/* Direct Answer & Cache Telemetry */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-600 block">
                Core Conceptual Answer
              </span>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isCachedResult ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
                      <Database className="w-3 h-3 text-emerald-600" />
                      <span>Instant (localStorage cache)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => queryConceptTutor(userQuestion, userCode, true)}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer font-medium"
                      title="Bypass cache and re-query live Gemini API"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Live Re-query</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>Cached in LocalStorage</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {tutorAnswer.directAnswer}
              </p>
            </div>

            {/* Detailed Explanation */}
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line border-t border-slate-200 pt-3">
              {tutorAnswer.detailedExplanation}
            </div>

            {/* Code snippet if provided */}
            {tutorAnswer.codeExample && (
              <div className="space-y-1.5 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Implementation ({tutorAnswer.codeExample.language})</span>
                  </span>
                  <span className="italic">{tutorAnswer.codeExample.explanation}</span>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{tutorAnswer.codeExample.code}</code>
                </pre>
              </div>
            )}

            {/* Quick Check Quiz */}
            {tutorAnswer.quickCheckQuestion && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Quick Check: Test Your Understanding
                </span>
                <p className="text-xs text-slate-700">
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
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          hasAnsweredQuiz
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
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
                  <p className="text-xs text-slate-600 p-2.5 bg-white border border-slate-200 rounded-lg">
                    {tutorAnswer.quickCheckQuestion.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
