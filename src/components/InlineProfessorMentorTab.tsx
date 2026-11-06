import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Send,
  Loader2,
  Code2,
  Compass,
  ListOrdered,
  BookOpen,
  CheckCircle2,
  Zap,
  Briefcase,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { Tracker, Lesson, ConceptTutorAnswer } from '../types';
import { aiMentorStorage, buildSmartConceptFallback } from '../utils/aiMentorCache';
import { buildInlineProfessorQuickPrompt } from '../utils/studyWorkspaceLogic';

interface InlineProfessorMentorTabProps {
  tracker: Tracker;
  currentLesson: Lesson;
  currentLessonIndex: number;
  onOpenFullMentorView?: () => void;
}

export const InlineProfessorMentorTab: React.FC<InlineProfessorMentorTabProps> = ({
  tracker,
  currentLesson,
  currentLessonIndex,
  onOpenFullMentorView,
}) => {
  const [questionInput, setQuestionInput] = useState<string>('');
  const [activeFocusMode, setActiveFocusMode] = useState<'explain' | 'code' | 'quiz' | 'custom'>(
    'explain'
  );
  const [explanationStyle, setExplanationStyle] = useState<'simple' | 'technical'>('simple');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tutorAnswer, setTutorAnswer] = useState<ConceptTutorAnswer | null>(() =>
    buildSmartConceptFallback(
      tracker.title,
      currentLesson,
      currentLesson.title,
      tracker.category,
      'simple'
    )
  );
  const [lastAskedPrompt, setLastAskedPrompt] = useState<string>(() =>
    buildInlineProfessorQuickPrompt('explain', currentLesson.title, currentLesson.keyConcepts)
  );
  const [quizSelection, setQuizSelection] = useState<number | null>(null);
  const [hasAnsweredQuiz, setHasAnsweredQuiz] = useState<boolean>(false);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(0);

  // Sync default Professor answer when switching lessons
  useEffect(() => {
    const defaultPrompt = buildInlineProfessorQuickPrompt(
      'explain',
      currentLesson.title,
      currentLesson.keyConcepts
    );
    setLastAskedPrompt(defaultPrompt);
    setQuestionInput('');
    setActiveFocusMode('explain');
    setQuizSelection(null);
    setHasAnsweredQuiz(false);

    const cached = aiMentorStorage.getConceptAnswer(
      tracker.title,
      currentLesson.title,
      defaultPrompt,
      explanationStyle
    );
    if (cached) {
      setTutorAnswer(cached.answer);
      setResponseTimeMs(0);
    } else {
      setTutorAnswer(
        buildSmartConceptFallback(
          tracker.title,
          currentLesson,
          currentLesson.title,
          tracker.category
        )
      );
      setResponseTimeMs(1);
    }
  }, [tracker.id, tracker.title, tracker.category, currentLesson.id, currentLesson.title]);

  const executeMentorQuery = async (
    promptText: string,
    mode: 'explain' | 'code' | 'quiz' | 'custom',
    forceRefresh: boolean = false
  ) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    setActiveFocusMode(mode);
    setLastAskedPrompt(trimmed);
    setQuizSelection(null);
    setHasAnsweredQuiz(false);

    if (!forceRefresh) {
      const cached = aiMentorStorage.getConceptAnswer(
        tracker.title,
        currentLesson.title,
        trimmed,
        explanationStyle
      );
      if (cached) {
        setTutorAnswer(cached.answer);
        setResponseTimeMs(0);
        return;
      }
    }

    const startTick = performance.now();
    const instantFallback = buildSmartConceptFallback(
      tracker.title,
      currentLesson,
      trimmed,
      tracker.category,
      explanationStyle
    );
    setTutorAnswer(instantFallback);
    setResponseTimeMs(Math.max(1, Math.round(performance.now() - startTick)));
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('/api/concept-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: tracker.title,
          currentLesson: currentLesson.title,
          question: trimmed,
          codeSnippet: '',
          explanationStyle,
        }),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTick);
      if (data.success && data.data) {
        setTutorAnswer(data.data);
        setResponseTimeMs(data.latencyMs ?? elapsed);
        aiMentorStorage.setConceptAnswer(
          tracker.title,
          currentLesson.title,
          trimmed,
          data.data,
          explanationStyle
        );
      } else {
        aiMentorStorage.setConceptAnswer(
          tracker.title,
          currentLesson.title,
          trimmed,
          instantFallback,
          explanationStyle
        );
      }
    } catch {
      aiMentorStorage.setConceptAnswer(
        tracker.title,
        currentLesson.title,
        trimmed,
        instantFallback,
        explanationStyle
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: 'explain' | 'code' | 'quiz') => {
    const generatedPrompt = buildInlineProfessorQuickPrompt(
      action,
      currentLesson.title,
      currentLesson.keyConcepts
    );
    setQuestionInput(generatedPrompt);
    executeMentorQuery(generatedPrompt, action);
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    executeMentorQuery(questionInput, 'custom');
  };

  return (
    <div
      data-testid="inline-professor-mentor-panel"
      className="flex flex-col h-full space-y-2.5"
    >
      {/* Compact Header: Current Lecture Context + Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-900 truncate">
            AI Professor Mentor · Lec {currentLessonIndex + 1}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setExplanationStyle('simple')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                explanationStyle === 'simple'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Beginner
            </button>
            <button
              type="button"
              onClick={() => setExplanationStyle('technical')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                explanationStyle === 'technical'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Technical
            </button>
          </div>

          {onOpenFullMentorView && (
            <button
              type="button"
              onClick={onOpenFullMentorView}
              className="p-1 text-slate-500 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
              title="Open full-page Concept Mentor view"
              aria-label="Open full-page Concept Mentor view"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Quick Action Buttons: "Explain Current Topic Simply", "Give Code Example", "Quiz Me on This Lecture" */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        <button
          type="button"
          data-testid="mentor-quick-explain"
          onClick={() => handleQuickAction('explain')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer text-center truncate ${
            activeFocusMode === 'explain'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
          }`}
        >
          Explain Current Topic Simply
        </button>

        <button
          type="button"
          data-testid="mentor-quick-code"
          onClick={() => handleQuickAction('code')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer text-center truncate ${
            activeFocusMode === 'code'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
          }`}
        >
          Give Code Example
        </button>

        <button
          type="button"
          data-testid="mentor-quick-quiz"
          onClick={() => handleQuickAction('quiz')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer text-center truncate ${
            activeFocusMode === 'quiz'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
          }`}
        >
          Quiz Me on This Lecture
        </button>
      </div>

      {/* Interactive Doubt Input Form */}
      <form onSubmit={handleCustomQuestionSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          data-testid="inline-mentor-question-input"
          value={questionInput}
          onChange={e => setQuestionInput(e.target.value)}
          placeholder={`Ask any doubt about "${currentLesson.title}"...`}
          aria-label="Ask Professor Mentor a question about this lecture"
          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
        />
        <button
          type="submit"
          data-testid="inline-mentor-submit-btn"
          disabled={isLoading || !questionInput.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Ask</span>
        </button>
      </form>

      {/* Scrollable AI Professor Response Container (Fits right beside the video without page scroll) */}
      <div
        data-testid="inline-mentor-response-area"
        className="flex-1 overflow-y-auto max-h-[340px] min-h-[200px] border border-slate-200 rounded-xl bg-slate-50/70 p-3 space-y-3"
      >
        {tutorAnswer && (
          <>
            {/* Top Status Strip */}
            <div className="flex items-center justify-between gap-2 text-[11px] border-b border-slate-200/80 pb-2">
              <span className="font-bold text-indigo-700 truncate">
                {activeFocusMode === 'code'
                  ? 'Professor Code Walkthrough'
                  : activeFocusMode === 'quiz'
                  ? 'Interactive Lecture Concept Quiz'
                  : 'Professor’s Plain-English Breakdown'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {responseTimeMs !== null && (
                  <span className="font-mono tabular-nums text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>{responseTimeMs === 0 ? 'Instant' : 'Live AI'}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => executeMentorQuery(lastAskedPrompt, activeFocusMode, true)}
                  className="text-slate-500 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                  title="Regenerate explanation"
                  aria-label="Regenerate explanation"
                >
                  <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* If "Quiz Me on This Lecture" was clicked, promote the interactive quiz to the very top */}
            {activeFocusMode === 'quiz' && tutorAnswer.quickCheckQuestion && (
              <div
                data-testid="inline-mentor-quiz-card"
                className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Quick Lecture Quiz:</span>
                </div>
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {tutorAnswer.quickCheckQuestion.question}
                </p>
                <div className="space-y-1.5">
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
                        className={`w-full text-left p-2 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          hasAnsweredQuiz
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                              : isSelected
                              ? 'bg-rose-50 border-rose-300 text-rose-900 line-through'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                            : isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50/50'
                        }`}
                      >
                        <span>{option}</span>
                        {hasAnsweredQuiz && isCorrect && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {hasAnsweredQuiz && (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[11px] text-emerald-950 leading-relaxed">
                    <strong>Professor’s Explanation: </strong>
                    {tutorAnswer.quickCheckQuestion.explanation}
                  </div>
                )}
              </div>
            )}

            {/* If "Give Code Example" was clicked, promote the code example + line-by-line right to the top */}
            {activeFocusMode === 'code' && tutorAnswer.codeExample && (
              <div
                data-testid="inline-mentor-code-card"
                className="space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Code Example ({tutorAnswer.codeExample.language})</span>
                  </span>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                  <code>{tutorAnswer.codeExample.code}</code>
                </pre>
                {tutorAnswer.codeExample.lineByLine &&
                  tutorAnswer.codeExample.lineByLine.length > 0 && (
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-800 block">
                        Line-by-Line Walkthrough:
                      </span>
                      <div className="divide-y divide-slate-100">
                        {tutorAnswer.codeExample.lineByLine.map((item, idx) => (
                          <div key={idx} className="py-1.5 text-[11px] space-y-0.5">
                            <code className="font-mono text-[10px] bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded block overflow-x-auto">
                              {item.line}
                            </code>
                            <p className="text-slate-700 leading-snug">
                              <strong className="text-indigo-600">&rarr; </strong>
                              {item.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* 1. Direct Plain-English Answer */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                {tutorAnswer.directAnswer}
              </p>
            </div>

            {/* 2. Real-World Analogy */}
            {tutorAnswer.realWorldAnalogy && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <strong className="text-amber-950 font-bold block text-[11px]">
                    Real-World Analogy
                  </strong>
                  <p className="text-amber-950 leading-relaxed text-[11px]">
                    {tutorAnswer.realWorldAnalogy}
                  </p>
                </div>
              </div>
            )}

            {/* 3. Technical Deep Dive (when Technical style is active) */}
            {explanationStyle === 'technical' && tutorAnswer.technicalDeepDive && (
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300">
                  <Code2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Technical Internals &amp; Memory Behavior:</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-100 leading-relaxed">
                  {tutorAnswer.technicalDeepDive.exactDefinition}
                </p>
                <p className="text-[11px] text-emerald-200 leading-relaxed">
                  {tutorAnswer.technicalDeepDive.memoryAndExecutionBehavior}
                </p>
              </div>
            )}

            {/* 4. Step-by-Step Breakdown */}
            {tutorAnswer.stepByStepBreakdown && tutorAnswer.stepByStepBreakdown.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Step-by-Step Breakdown:</span>
                </span>
                <div className="space-y-1.5">
                  {tutorAnswer.stepByStepBreakdown.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-start gap-2 text-[11px] text-slate-700"
                    >
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show Code Example below if not already shown at top */}
            {activeFocusMode !== 'code' && tutorAnswer.codeExample && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                  <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Code Example ({tutorAnswer.codeExample.language}):</span>
                </span>
                <pre className="p-2.5 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                  <code>{tutorAnswer.codeExample.code}</code>
                </pre>
              </div>
            )}

            {/* Show Interactive Quiz below if not already promoted to top */}
            {activeFocusMode !== 'quiz' && tutorAnswer.quickCheckQuestion && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Quick Concept Check:</span>
                </span>
                <p className="text-xs font-medium text-slate-800">
                  {tutorAnswer.quickCheckQuestion.question}
                </p>
                <div className="space-y-1">
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
                        className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          hasAnsweredQuiz
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                              : isSelected
                              ? 'bg-rose-50 border-rose-300 text-rose-900 line-through'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                            : isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{option}</span>
                        {hasAnsweredQuiz && isCorrect && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {hasAnsweredQuiz && (
                  <p className="text-[11px] text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <strong>Professor: </strong>
                    {tutorAnswer.quickCheckQuestion.explanation}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
