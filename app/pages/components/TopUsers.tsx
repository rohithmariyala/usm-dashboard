import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, Eye, X, Search, ArrowDown, ArrowUp } from 'lucide-react';
import { ArtifactStats } from '../types';

interface TopUsersProps {
  users: ArtifactStats['by_user'];
}

const TopUsers: React.FC<TopUsersProps> = ({ users }) => {
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'email' | 'lastActive'>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModalRoot(document.body);
    if (showAllUsers) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAllUsers]);

  useEffect(() => {
    if (showAllUsers && searchInputRef.current) {
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 100);
    }
  }, [showAllUsers]);

  const topUsers = users.slice(0, 5);

  const filteredSortedUsers = useMemo(() => {
    return [...users]
      .filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'count') {
          comparison = a.count - b.count;
        } else if (sortBy === 'email') {
          comparison = a.email.localeCompare(b.email);
        } else if (sortBy === 'lastActive') {
          const aDate = a.last_active ?? '';
          const bDate = b.last_active ?? '';
          comparison = aDate.localeCompare(bDate);
        }
        return sortDirection === 'desc' ? -comparison : comparison;
      });
  }, [users, searchTerm, sortBy, sortDirection]);

  const formatUserEmail = (email: string) => {
    if (!email.includes('@') || email.length < 12) return email;
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const username = parts[0].length > 8 ? `${parts[0].substring(0, 6)}...` : parts[0];
    const domain = parts[1].length > 12 ? `${parts[1].substring(0, 10)}...` : parts[1];
    return `${username}@${domain}`;
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSortChange = (field: 'count' | 'email' | 'lastActive') => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection(field === 'email' ? 'asc' : 'desc');
    }
  };

  const getAvatarColor = (initial: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-blue-600/20 text-blue-400',
      'B': 'bg-green-600/20 text-green-400',
      'C': 'bg-purple-600/20 text-purple-400',
      'D': 'bg-red-600/20 text-red-400',
      'E': 'bg-purple-600/20 text-purple-400',
      'H': 'bg-blue-600/20 text-blue-400',
      'N': 'bg-purple-600/20 text-purple-400',
      'S': 'bg-green-600/20 text-green-400',
    };
    return colors[initial] || 'bg-purple-600/20 text-purple-400';
  };

  const AllUsersModal = () => {
    if (!showAllUsers) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90">
        <div className="w-full max-w-xl rounded-lg overflow-hidden bg-slate-800/90 backdrop-blur-sm border border-slate-700">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Top Users</h3>
            <button
              onClick={() => { setShowAllUsers(false); setSearchTerm(''); }}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-500" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                className="bg-slate-900 border-none rounded w-full py-2 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label="Search users"
              />
            </div>
          </div>

          <div className="px-4 py-2 flex justify-between items-center border-b border-slate-700 text-sm font-medium">
            <button
              className={`flex items-center ${sortBy === 'email' ? 'text-blue-400' : 'text-slate-400'}`}
              onClick={() => handleSortChange('email')}
            >
              User
              {sortBy === 'email' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />)}
            </button>
            <div className="flex items-center gap-10">
              <button
                className={`flex items-center justify-end w-8 ${sortBy === 'count' ? 'text-blue-400' : 'text-slate-400'}`}
                onClick={() => handleSortChange('count')}
              >
                Stories
                {sortBy === 'count' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />)}
              </button>
              <button
                className={`flex items-center justify-end ${sortBy === 'lastActive' ? 'text-blue-400' : 'text-slate-400'}`}
                onClick={() => handleSortChange('lastActive')}
              >
                Last Active
                {sortBy === 'lastActive' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />)}
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredSortedUsers.length === 0 ? (
              <div className="py-6 text-center text-slate-400">No users match your search</div>
            ) : (
              filteredSortedUsers.map(user => {
                const initial = user.email.charAt(0).toUpperCase();
                return (
                  <div
                    key={user.email}
                    className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30"
                  >
                    <div className="flex items-center">
                      <div className={`${getAvatarColor(initial)} rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium`}>
                        {initial}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-white">{user.email}</p>
                        <p className="text-xs text-slate-400">
                          {user.templates.filter(Boolean).length} {user.templates.length === 1 ? 'template' : 'templates'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <div className="w-8 text-right text-white font-medium">{user.count}</div>
                      <div className="text-right text-slate-400">{formatLastActive(user.last_active)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Top Users</h3>
          <p className="text-sm text-slate-400">Users by story count</p>
        </div>
        <Users className="w-5 h-5 text-slate-400" />
      </div>

      {topUsers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500">No user data available</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {topUsers.map((user, index) => {
              const initial = user.email.charAt(0).toUpperCase();
              return (
                <div key={user.email} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-6 text-center font-medium text-slate-500">
                      {index + 1}
                    </div>
                    <div className="flex items-center ml-3">
                      <div className={`${getAvatarColor(initial)} rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium`}>
                        {initial}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-white truncate max-w-[150px]" title={user.email}>
                          {formatUserEmail(user.email)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {user.templates.filter(Boolean).length} {user.templates.length === 1 ? 'template' : 'templates'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{user.count}</p>
                    <p className="text-xs text-slate-400">stories</p>
                  </div>
                </div>
              );
            })}
          </div>

          {users.length > 5 && (
            <div className="pt-2 flex justify-end">
              <button
                className="flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                onClick={() => setShowAllUsers(true)}
              >
                <Eye className="w-4 h-4 mr-1" />
                View All Members
              </button>
            </div>
          )}
        </>
      )}

      {modalRoot && createPortal(<AllUsersModal />, modalRoot)}
    </div>
  );
};

export default TopUsers;
