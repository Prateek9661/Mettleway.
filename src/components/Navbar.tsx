import React from 'react';
import { Plus, EyeOff } from 'lucide-react';
import { NavTab } from '../utils/studyWorkspaceLogic';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
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
          ? 'bg-zinc-950/98 border-zinc-800 text-white'
          : 'bg-zinc-950/95 border-zinc-800 text-zinc-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark using exact brand name "Mettleway." */}
          <button
            type="button"
            data-testid="brand-wordmark"
            onClick={() => setActiveTab('today')}
            className="text-xl font-extrabold tracking-tight transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none text-white hover:text-amber-400"
          >
            Mettleway<span className="text-amber-500">.</span>
          </button>

          {/* Zone 2: 5 concise single-line text navigation links */}
          {isDeepWork ? (
            <div className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-300">
              <span className="flex items-center gap-2 text-amber-400 font-semibold whitespace-nowrap shrink-0">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Deep Work Active · Non-essential views hidden</span>
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'today'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                Active Session
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mentor')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'mentor'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                Concept Mentor
              </button>
            </div>
          ) : (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
              <button
                type="button"
                data-testid="nav-tab-today"
                onClick={() => setActiveTab('today')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'today'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent hover:text-white hover:border-zinc-600'
                }`}
              >
                Today&apos;s Tasks
              </button>
              <button
                type="button"
                data-testid="nav-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent hover:text-white hover:border-zinc-600'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                data-testid="nav-tab-notes"
                onClick={() => setActiveTab('notes')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'notes'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent hover:text-white hover:border-zinc-600'
                }`}
              >
                My Notes
              </button>
              <button
                type="button"
                data-testid="nav-tab-library"
                onClick={() => setActiveTab('library')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'library'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent hover:text-white hover:border-zinc-600'
                }`}
              >
                Course Library
              </button>
              <button
                type="button"
                data-testid="nav-tab-mentor"
                onClick={() => setActiveTab('mentor')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === 'mentor'
                    ? 'border-amber-500 text-amber-400 font-semibold'
                    : 'border-transparent hover:text-white hover:border-zinc-600'
                }`}
              >
                Concept Mentor
              </button>
            </nav>
          )}

          {/* Zone 3: 1 Primary Action in Forge Amber */}
          <div className="flex items-center gap-3 shrink-0">
            {isDeepWork ? (
              <button
                type="button"
                onClick={onToggleDeepWork}
                className="px-4 py-2 text-xs font-extrabold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Exit Deep Work
              </button>
            ) : (
              <button
                type="button"
                data-testid="navbar-add-course-btn"
                onClick={onOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-zinc-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {isDeepWork ? (
          <div className="md:hidden flex items-center justify-between py-2 border-t border-zinc-800 text-xs font-medium text-zinc-300">
            <span className="text-amber-400 font-semibold flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Deep Work Mode</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`px-2 py-1 ${activeTab === 'today' ? 'text-amber-400 font-bold underline' : 'text-zinc-400'}`}
              >
                Session
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mentor')}
                className={`px-2 py-1 ${activeTab === 'mentor' ? 'text-amber-400 font-bold underline' : 'text-zinc-400'}`}
              >
                Mentor
              </button>
            </div>
          </div>
        ) : (
          <div className="md:hidden flex items-center justify-between gap-2 py-2 border-t border-zinc-800 text-xs font-medium text-zinc-300 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'today' ? 'text-amber-400 font-bold' : ''}`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'text-amber-400 font-bold' : ''}`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'notes' ? 'text-amber-400 font-bold' : ''}`}
            >
              My Notes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'library' ? 'text-amber-400 font-bold' : ''}`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'curriculum' ? 'text-amber-400 font-bold' : ''}`}
            >
              Roadmap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mentor')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'mentor' ? 'text-amber-400 font-bold' : ''}`}
            >
              Mentor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'profile' ? 'text-amber-400 font-bold' : ''}`}
            >
              My Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('squads')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'squads' ? 'text-amber-400 font-bold' : ''}`}
            >
              Squads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'schedule' ? 'text-amber-400 font-bold' : ''}`}
            >
              Schedule
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
