"use client";

import React from 'react';
import { Activity } from 'lucide-react';
import { ArtifactStats } from '../types';

interface UserAnalyticsProps {
  users: ArtifactStats['by_user'];
  onUserClick: (email: string) => void;
  internalEmails: string[];
}

const AVATAR_COLORS = [
  'bg-blue-600/30 text-blue-300',
  'bg-purple-600/30 text-purple-300',
  'bg-green-600/30 text-green-300',
  'bg-rose-600/30 text-rose-300',
  'bg-amber-600/30 text-amber-300',
  'bg-cyan-600/30 text-cyan-300',
  'bg-indigo-600/30 text-indigo-300',
  'bg-teal-600/30 text-teal-300',
];

const getAvatarColor = (email: string) => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatLastActive = (dateStr: string | null) => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const UserAnalytics: React.FC<UserAnalyticsProps> = ({ users, onUserClick, internalEmails }) => {
  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400">
        <p>No user data available for the selected period.</p>
      </div>
    );
  }

  const maxCount = users[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        {users.length} user{users.length !== 1 ? 's' : ''} active · click a card to view their requirements
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map((user) => {
          const initial = user.email.charAt(0).toUpperCase();
          const isInternal = internalEmails.includes(user.email);
          const fillPct = Math.round((user.count / maxCount) * 100);
          const validTemplates = user.templates.filter(Boolean);

          return (
            <div
              key={user.email}
              onClick={() => onUserClick(user.email)}
              className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
            >
              {/* Avatar + email row */}
              <div className="flex items-start gap-3">
                <div className={`${getAvatarColor(user.email)} rounded-full h-10 w-10 flex items-center justify-center text-sm font-semibold shrink-0`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate" title={user.email}>
                      {user.email}
                    </p>
                    {isInternal && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
                        Internal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last active: {formatLastActive(user.last_active)}
                  </p>
                </div>
              </div>

              {/* Count + icon */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{user.count}</p>
                  <p className="text-xs text-slate-400">requirements</p>
                </div>
                <Activity className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors mb-1" />
              </div>

              {/* Relative usage bar */}
              <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              {/* Templates */}
              {validTemplates.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {validTemplates.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 truncate max-w-[110px]"
                      title={t}
                    >
                      {t}
                    </span>
                  ))}
                  {validTemplates.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500">
                      +{validTemplates.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserAnalytics;
