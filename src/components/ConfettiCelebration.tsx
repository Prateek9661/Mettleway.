import React, { useEffect, useRef } from 'react';
import { Flame, Award, ArrowRight, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface ConfettiCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  streakDays: number;
  lessonTitle?: string;
  minutesStudied: number;
  onNavigateToMentor?: () => void;
}

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  isOpen,
  onClose,
  streakDays,
  lessonTitle,
  minutesStudied,
  onNavigateToMentor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366F1', '#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];
    const particleCount = 140;
    const particles: Particle[] = [];

    // Spawn burst from center-top
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI / 180) * (Math.random() * 360);
      const speed = Math.random() * 8 + 4;
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: canvas.height * 0.35 + (Math.random() - 0.5) * 40,
        w: Math.random() * 9 + 5,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
      });
    }

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.005; // gradual fade

        if (p.opacity > 0 && p.y < canvas.height + 20) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* 60fps Canvas Confetti Layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-10"
      />

      {/* Celebration Card */}
      <div className="relative z-20 bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-6 transform transition-all scale-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close celebration modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Milestone Flame & Badge */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 bg-amber-100/80 rounded-full flex items-center justify-center ring-8 ring-amber-50">
            <Flame className="w-10 h-10 text-amber-500 fill-amber-500 animate-pulse" />
          </div>
          <div className="absolute -bottom-2 bg-slate-900 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider font-mono shadow-xs">
            {streakDays} Day Streak!
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Daily Session Complete</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Outstanding Discipline!
          </h2>
          <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
            {lessonTitle ? (
              <>
                You conquered <strong className="text-slate-800 font-semibold">"{lessonTitle}"</strong> and hit today's study target.
              </>
            ) : (
              "You successfully completed your daily study target on schedule!"
            )}
          </p>
        </div>

        {/* Milestone Stats Bar */}
        <div className="grid grid-cols-3 gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
          <div className="text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Logged</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
              +{minutesStudied}m
            </span>
          </div>
          <div className="text-center border-x border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Streak</span>
            <span className="font-bold text-amber-600 font-mono tabular-nums text-sm flex items-center justify-center gap-0.5">
              <Flame className="w-3.5 h-3.5 fill-amber-500" />
              {streakDays}d
            </span>
          </div>
          <div className="text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Squad XP</span>
            <span className="font-bold text-indigo-600 font-mono tabular-nums text-sm">
              +150 XP
            </span>
          </div>
        </div>

        {/* Inspiring AI Advice Note */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-left flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-950 leading-relaxed">
            <strong className="block font-semibold mb-0.5">Retain Today's Concept:</strong>
            Spend 5 minutes tonight reflecting on the mental models you practiced. Your study squad has been updated with your new velocity!
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Continue Learning</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onNavigateToMentor && (
            <button
              onClick={() => {
                onClose();
                onNavigateToMentor();
              }}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-slate-500" />
              <span>Review AI Recap & Practice Doubts</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
