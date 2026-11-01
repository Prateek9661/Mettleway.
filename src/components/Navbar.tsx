import React from 'react';
import { Plus, Shield, EyeOff } from 'lucide-react';

interface NavbarProps {
  activeTab: 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule';
  setActiveTab: (tab: 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule') => void;
  streakDays: number;
  isMuted: boolean;
  toggleMute: () => void;
  onOpenCreateModal: () => void;
  scheduledTime: string;
  isDeepWork: boolean;
  onToggleDeepWork: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  isDeepWork,
  onToggleDeepWork,
}) => {
  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${
        isDeepWork
          ? 'bg-slate-900/95 border-slate-800 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`text-xl font-extrabold tracking-tight transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none ${
              isDeepWork ? 'text-white hover:text-indigo-400' : 'text-slate-900 hover:text-indigo-600'
            }`}
          >
            DevTrack
          </button>

          {/* Zone 2: Navigation links (hides non-essential tabs in Deep Work mode) */}
          {isDeepWork ? (
            <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
              <span className="flex items-center gap-2 text-indigo-300 font-semibold whitespace-nowrap shrink-0">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Deep Work Active · Non-essential views hidden</span>
              </span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'today'
                    ? 'border-indigo-400 text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Active Study Session
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mentor')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'mentor'
                    ? 'border-indigo-400 text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Ask Professor Mentor
              </button>
            </div>
          ) : (
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'today'
                    ? 'border-indigo-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Today&apos;s Tasks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'curriculum'
                    ? 'border-indigo-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Study Roadmap
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mentor')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'mentor'
                    ? 'border-indigo-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Concept Mentor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('squads')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'squads'
                    ? 'border-indigo-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Study Squads
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'schedule'
                    ? 'border-indigo-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Schedule &amp; Sync
              </button>
            </nav>
          )}

          {/* Zone 3: Deep Work Toggle + Primary Action (max 2 items) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleDeepWork}
              aria-pressed={isDeepWork}
              title={
                isDeepWork
                  ? 'Exit Deep Work mode and restore all navigation tabs'
                  : 'Enable Deep Work mode to hide squads, roadmap lists, and distractions'
              }
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isDeepWork
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isDeepWork ? 'Exit Deep Work' : 'Deep Work'}</span>
            </button>

            {!isDeepWork && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row (Hidden in Deep Work mode except session/mentor toggle) */}
        {isDeepWork ? (
          <div className="md:hidden flex items-center justify-between py-2 border-t border-slate-800 text-xs font-medium text-slate-300">
            <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Deep Work Mode</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`px-2 py-1 ${activeTab === 'today' ? 'text-white font-bold underline' : 'text-slate-400'}`}
              >
                Study Session
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mentor')}
                className={`px-2 py-1 ${activeTab === 'mentor' ? 'text-white font-bold underline' : 'text-slate-400'}`}
              >
                Mentor
              </button>
            </div>
          </div>
        ) : (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs font-medium text-slate-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'today' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'curriculum' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Roadmap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mentor')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'mentor' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Mentor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('squads')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'squads' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Squads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'schedule' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Schedule
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
