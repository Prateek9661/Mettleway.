import React, { useState } from 'react';
import { Users, Flame, Award, Heart, BellRing, Copy, Check, Plus, ArrowUpRight } from 'lucide-react';
import { StudySquad, SquadMember } from '../types';

interface StudySquadsViewProps {
  squads: StudySquad[];
  currentSquadId: string;
  onSelectSquad: (squadId: string) => void;
  onSendCheer: (memberId: string) => void;
  onNudge: (memberId: string) => void;
  onJoinSquad: (code: string) => void;
  onCreateSquad: (name: string, track: string, goal: string) => void;
}

export const StudySquadsView: React.FC<StudySquadsViewProps> = ({
  squads,
  currentSquadId,
  onSelectSquad,
  onSendCheer,
  onNudge,
  onJoinSquad,
  onCreateSquad,
}) => {
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [toastAlert, setToastAlert] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCreatingSquad, setIsCreatingSquad] = useState<boolean>(false);
  const [newSquadName, setNewSquadName] = useState<string>('');
  const [newSquadGoal, setNewSquadGoal] = useState<string>('');

  const activeSquad = squads.find(s => s.id === currentSquadId) || squads[0];

  const handleCopyInvite = () => {
    if (!activeSquad) return;
    navigator.clipboard?.writeText(activeSquad.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleNudgeMember = (member: SquadMember) => {
    onNudge(member.id);
    setToastAlert(`🔔 Nudge alert sent to ${member.name}! Reminded them to study on time.`);
    setTimeout(() => setToastAlert(null), 3500);
  };

  const handleCheerMember = (member: SquadMember) => {
    onSendCheer(member.id);
    setToastAlert(`🔥 Sent cheer to ${member.name}! +1 Cheer added.`);
    setTimeout(() => setToastAlert(null), 3000);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    onJoinSquad(joinCodeInput.trim().toUpperCase());
    setJoinCodeInput('');
    setToastAlert(`🎉 Successfully joined squad!`);
    setTimeout(() => setToastAlert(null), 3000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;
    onCreateSquad(newSquadName, activeSquad.trackName, newSquadGoal || 'Complete curriculum on time');
    setIsCreatingSquad(false);
    setNewSquadName('');
    setNewSquadGoal('');
    setToastAlert(`🚀 Squad "${newSquadName}" created!`);
    setTimeout(() => setToastAlert(null), 3000);
  };

  // Sort members by streak & minutes
  const sortedMembers = [...(activeSquad?.members || [])].sort((a, b) => {
    if (b.streakDays !== a.streakDays) {
      return b.streakDays - a.streakDays;
    }
    return b.weeklyMinutes - a.weeklyMinutes;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm flex items-center gap-2 animate-bounce">
          <span>{toastAlert}</span>
        </div>
      )}

      {/* Header and Squad Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
            <Users className="w-4 h-4" />
            <span>Study Squads & Peer Accountability</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Learn Together, Never Fall Behind
          </h1>
        </div>

        {/* Squad Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {squads.map(sq => (
              <button
                key={sq.id}
                onClick={() => onSelectSquad(sq.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  sq.id === activeSquad.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sq.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCreatingSquad(true)}
            className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium cursor-pointer"
            title="Create new squad"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create Squad Modal / Panel */}
      {isCreatingSquad && (
        <div className="p-5 bg-white border border-indigo-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Create a New Study Squad</h3>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Squad Name (e.g. LeetCode 30-Day Cohort)"
              value={newSquadName}
              onChange={e => setNewSquadName(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Shared Goal (e.g. Finish Trees & Graphs)"
              value={newSquadGoal}
              onChange={e => setNewSquadGoal(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                Create Squad
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingSquad(false)}
                className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Squad Overview Card & Milestone Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Track: {activeSquad.trackName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeSquad.members.length} Members Active</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {activeSquad.name}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {activeSquad.description}
            </p>
          </div>

          {/* Invite Code button */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-xs text-slate-500">Invite Code:</span>
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedCode ? 'Copied!' : activeSquad.inviteCode}</span>
            </button>
          </div>
        </div>

        {/* Group Milestone Goal */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Squad Target: {activeSquad.squadGoal}</span>
            </span>
            <span className="font-mono tabular-nums font-bold text-indigo-600">
              {activeSquad.totalGoalCompletedPercent}% Achieved
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${activeSquad.totalGoalCompletedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Squad Leaderboard + Peer Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Leaderboard Table (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Squad Consistency Leaderboard
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Ranked by Daily Streak & Velocity
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono">
                  <th className="py-2.5 pl-2 font-medium">Rank</th>
                  <th className="py-2.5 font-medium">Student</th>
                  <th className="py-2.5 font-medium">Current Streak</th>
                  <th className="py-2.5 font-medium text-right">Weekly Time</th>
                  <th className="py-2.5 font-medium text-center">Today</th>
                  <th className="py-2.5 pr-2 font-medium text-right">Accountability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMembers.map((member, rIdx) => (
                  <tr
                    key={member.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      member.isCurrentUser ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 pl-2 font-mono font-bold text-slate-700">
                      #{rIdx + 1}
                    </td>

                    {/* Student Info */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{member.name}</span>
                            {member.isCurrentUser && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[140px] sm:max-w-xs">
                            {member.currentLesson}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Streak */}
                    <td className="py-3.5 font-mono tabular-nums">
                      <div className="flex items-center gap-1 font-bold text-amber-700">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                        <span>{member.streakDays} Days</span>
                      </div>
                    </td>

                    {/* Weekly Minutes */}
                    <td className="py-3.5 text-right font-mono tabular-nums text-slate-700 font-semibold">
                      {member.weeklyMinutes}m
                    </td>

                    {/* Today Status */}
                    <td className="py-3.5 text-center">
                      {member.completedToday ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Finished
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions: Cheer or Nudge */}
                    <td className="py-3.5 pr-2 text-right">
                      {member.isCurrentUser ? (
                        <div className="text-[11px] text-slate-400 font-mono">
                          {member.cheerCount} Cheers ❤️
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCheerMember(member)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Send cheers"
                          >
                            <Heart className="w-3.5 h-3.5 fill-rose-50" />
                          </button>
                          {!member.completedToday && (
                            <button
                              type="button"
                              onClick={() => handleNudgeMember(member)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Nudge to study on schedule"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Join Squad & Live Feed (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Join Squad by Code */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Join Cohort with Invite Code
            </h4>
            <form onSubmit={handleJoinSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter invite code..."
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase font-mono"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>

          {/* Live Study Feed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Squad Activity Feed
            </h4>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-800">Priya Sharma</span>
                  <span className="font-mono">15m ago</span>
                </div>
                <p className="text-slate-600">
                  Completed "Lec 5: Kadane's Algorithm" & solved LeetCode #53 in 25 mins!
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-800">Marcus Chen</span>
                  <span className="font-mono">1h ago</span>
                </div>
                <p className="text-slate-600">
                  Hit a 5-day streak on Two-Pointer lessons!
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-800">DevTrack Bot</span>
                  <span className="font-mono">Today</span>
                </div>
                <p className="text-slate-600">
                  Daily study session scheduled for <strong>{activeSquad.name}</strong> at 20:00!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
