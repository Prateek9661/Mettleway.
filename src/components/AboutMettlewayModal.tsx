import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  Bell,
  Flame,
  NotebookPen,
  Compass,
  Mail,
  Copy,
  Check,
  ArrowLeft,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  METTLEWAY_FEEDBACK_EMAIL,
  buildMettlewayFeedbackMailtoUrl,
} from '../utils/studyWorkspaceLogic';

interface AboutMettlewayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutMettlewayModal: React.FC<AboutMettlewayModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Allow closing cleanly with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setCopiedEmail(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const feedbackMailtoUrl = buildMettlewayFeedbackMailtoUrl(
    METTLEWAY_FEEDBACK_EMAIL,
    'Mettleway. Learner Suggestion'
  );

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(METTLEWAY_FEEDBACK_EMAIL);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = METTLEWAY_FEEDBACK_EMAIL;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  return (
    <div
      data-testid="about-mettleway-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-mettleway-title"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-zinc-100 relative overflow-hidden">
        {/* Top Forge Amber Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 shrink-0" />

        {/* 1. Header & Quick Return */}
        <div className="px-6 py-5 border-b border-zinc-800/90 flex items-start justify-between gap-4 shrink-0 bg-zinc-950">
          <div className="space-y-1">
            <h2
              id="about-mettleway-title"
              className="text-2xl font-extrabold tracking-tight text-white"
            >
              About Mettleway<span className="text-amber-500">.</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Turning self-paced study goals and video playlists into structured, dependable daily classes.
            </p>
          </div>
          <button
            type="button"
            data-testid="about-modal-close-btn"
            onClick={onClose}
            aria-label="Close About Mettleway modal"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* 2. About the Platform */}
          <section aria-labelledby="about-platform-heading" className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                01 · About the Platform
              </span>
            </div>
            <h3
              id="about-platform-heading"
              className="text-base font-bold text-white"
            >
              Built for Structured Daily Execution
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              <strong className="text-white">Mettleway<span className="text-amber-500">.</span></strong> helps learners—including college students and working professionals—turn self-paced courses, technical roadmaps, and YouTube playlists into disciplined daily study sessions. Instead of losing momentum after day two, you lock a recurring class time, get calendar and audio reminders, maintain an attendance streak, and capture timestamped lecture notes alongside clear lesson checklists.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Locked Class Timings</div>
                  <div className="text-[11px] text-zinc-400">
                    Commit to a fixed daily study hour and session length.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <Bell className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Calendar &amp; Chime Alerts</div>
                  <div className="text-[11px] text-zinc-400">
                    Sync recurring Google Calendar phone alarms and in-app chimes.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Streaks &amp; Attendance</div>
                  <div className="text-[11px] text-zinc-400">
                    Track consecutive daily sessions and verify on-time attendance.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <NotebookPen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Lecture Notes &amp; Checklists</div>
                  <div className="text-[11px] text-zinc-400">
                    Take course-linked timestamped notes and complete structured tasks.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-800/80" />

          {/* 3. Us (Founder & Builder) */}
          <section aria-labelledby="about-founder-heading" className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block">
              02 · Us
            </span>
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Cleanly Framed Founder Emblem / Portrait Container */}
              <div
                data-testid="founder-portrait-frame"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/40 flex flex-col items-center justify-center shrink-0 overflow-hidden shadow-lg relative"
              >
                <span className="text-2xl font-extrabold tracking-tight text-white">
                  PK<span className="text-amber-500">.</span>
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <UserCheck className="w-3 h-3" />
                  <span>Founder</span>
                </span>
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="about-founder-heading"
                    className="text-base sm:text-lg font-extrabold text-white"
                  >
                    Prateek Kumar Singh
                  </h3>
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    Founder &amp; Builder
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Founder of <strong className="text-white">Mettleway<span className="text-amber-500">.</span></strong> and the developer who built it. Created to solve a simple, widespread problem: great learning playlists are everywhere, yet self-learners struggle to finish them without structure. Mettleway. is engineered around practical daily study accountability rather than passive content consumption.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-800/80" />

          {/* 4. Platform Vision */}
          <section aria-labelledby="about-vision-heading" className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block">
              03 · Platform Vision
            </span>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-amber-500/25 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                <Compass className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3
                  id="about-vision-heading"
                  className="text-sm sm:text-base font-bold text-white"
                >
                  Consistent Skill-Building That Fits Real Life
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Our vision is to make consistent, everyday skill-building feel structured, realistic, and genuinely achievable—so students and working professionals can build lasting learning habits alongside college coursework or a full-time job.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-800/80" />

          {/* 5. Learner Suggestions & Feedback (Gmail) */}
          <section aria-labelledby="about-feedback-heading" className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block">
              04 · Learner Suggestions &amp; Feedback
            </span>
            <div
              data-testid="about-feedback-card"
              className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-amber-500/35 space-y-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="about-feedback-heading"
                    className="text-sm sm:text-base font-bold text-white"
                  >
                    Help Shape Mettleway<span className="text-amber-500">.</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Have a feature idea, workflow suggestion, or feedback on your daily study experience? Share it directly via Gmail—every learner suggestion is read carefully.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 min-w-0">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span
                    data-testid="about-feedback-email-text"
                    className="font-mono text-xs sm:text-sm text-zinc-100 truncate select-all"
                  >
                    {METTLEWAY_FEEDBACK_EMAIL}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="about-copy-email-btn"
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Copy Email</span>
                      </>
                    )}
                  </button>

                  <a
                    href={feedbackMailtoUrl}
                    data-testid="about-mailto-link"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 transition-colors shadow-sm cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Suggestion</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Quick Return */}
        <div className="px-6 py-4 border-t border-zinc-800/90 bg-zinc-950 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-zinc-300">Esc</kbd> or click outside to close
          </span>
          <button
            type="button"
            data-testid="about-modal-done-btn"
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};
