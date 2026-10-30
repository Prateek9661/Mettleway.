import React from 'react';
import { Volume2, VolumeX, Plus, Flame, Clock } from 'lucide-react';

interface NavbarProps {
  activeTab: 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule';
  setActiveTab: (tab: 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule') => void;
  streakDays: number;
  isMuted: boolean;
  toggleMute: () => void;
  onOpenCreateModal: () => void;
  scheduledTime: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  streakDays,
  isMuted,
  toggleMute,
  onOpenCreateModal,
  scheduledTime,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('today')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                DevTrack
              </span>
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono tabular-nums">{scheduledTime || '20:00'} Daily</span>
            </div>
          </div>

          {/* Zone 2: 5 single-line clean navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('today')}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'today'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Today's Session
            </button>
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'curriculum'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Roadmap & Lessons
            </button>
            <button
              onClick={() => setActiveTab('mentor')}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'mentor'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              AI Concept Mentor
            </button>
            <button
              onClick={() => setActiveTab('squads')}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'squads'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Study Squads
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'schedule'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Alerts & Calendar
            </button>
          </nav>

          {/* Zone 3: 1 primary action & essential utilities */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Streak indicator */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold cursor-default"
              title={`${streakDays} consecutive study days logged`}
            >
              <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span className="font-mono tabular-nums">{streakDays} Day Streak</span>
            </div>

            {/* Mute toggle button */}
            <button
              onClick={toggleMute}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={isMuted ? 'Unmute study session chime' : 'Mute study session chime'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Primary Action Button */}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-colors shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Playlist</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs font-medium text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-2 py-1 whitespace-nowrap ${activeTab === 'today' ? 'text-indigo-600 font-bold' : ''}`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-2 py-1 whitespace-nowrap ${activeTab === 'curriculum' ? 'text-indigo-600 font-bold' : ''}`}
          >
            Curriculum
          </button>
          <button
            onClick={() => setActiveTab('mentor')}
            className={`px-2 py-1 whitespace-nowrap ${activeTab === 'mentor' ? 'text-indigo-600 font-bold' : ''}`}
          >
            AI Mentor
          </button>
          <button
            onClick={() => setActiveTab('squads')}
            className={`px-2 py-1 whitespace-nowrap ${activeTab === 'squads' ? 'text-indigo-600 font-bold' : ''}`}
          >
            Squads
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-2 py-1 whitespace-nowrap ${activeTab === 'schedule' ? 'text-indigo-600 font-bold' : ''}`}
          >
            Alerts
          </button>
        </div>
      </div>
    </header>
  );
};
