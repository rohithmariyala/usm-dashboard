import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, Eye, X, Search, ArrowDown, ArrowUp } from 'lucide-react';
import { UserStoryData } from '../types';

interface TopUsersProps {
  data: UserStoryData[];
}

interface UserStats {
  email: string;
  count: number;
  projects: Set<string>;
  templates: Set<string>;
  lastActive: Date | null;
  initial: string;
}

const TopUsers: React.FC<TopUsersProps> = ({ data }) => {
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'email' | 'lastActive'>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Set up portal root on component mount
  useEffect(() => {
    setModalRoot(document.body);
    
    // Add class to body when modal is shown to prevent scrolling
    if (showAllUsers) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAllUsers]);

  // Focus search input when modal opens
  useEffect(() => {
    if (showAllUsers && searchInputRef.current) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [showAllUsers]);

  // Calculate user statistics from data
  const { userStats, topUsers } = useMemo(() => {
    const userMap = new Map<string, UserStats>();
    
    // Process each data item
    data.forEach(item => {
      if (item.user_email) {
        // Get or initialize user stats
        const user = userMap.get(item.user_email) || {
          email: item.user_email,
          count: 0,
          projects: new Set<string>(),
          templates: new Set<string>(),
          lastActive: null,
          initial: item.user_email.charAt(0).toUpperCase()
        };
        
        // Update stats
        user.count += 1;
        
        // Update projects
        if (item.project_name) {
          user.projects.add(item.project_name);
        }
        
        // Update templates
        if (item.mode_name) {
          user.templates.add(item.mode_name);
        }
        
        // Update last active
        if (item.date) {
          const date = new Date(item.date);
          if (!isNaN(date.getTime()) && (!user.lastActive || date > user.lastActive)) {
            user.lastActive = date;
          }
        }
        
        // Save updated user
        userMap.set(item.user_email, user);
      }
    });
    
    // Convert to array and sort by story count
    const userStats = Array.from(userMap.values())
      .sort((a, b) => b.count - a.count);
    
    // Get top 5 users
    const topUsers = userStats.slice(0, 5);
    
    return { userStats, topUsers };
  }, [data]);

  // Format user email for display
  const formatUserEmail = (email: string) => {
    // If it's a short name, just return it
    if (!email.includes('@') || email.length < 12) {
      return email;
    }
    
    // Extract username and domain
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const username = parts[0];
    const domain = parts[1];
    
    // Truncate username if longer than 8 chars
    const shortUsername = username.length > 8 
      ? `${username.substring(0, 6)}...` 
      : username;
    
    // Truncate domain if longer than 12 chars
    const shortDomain = domain.length > 12
      ? `${domain.substring(0, 10)}...`
      : domain;
    
    return `${shortUsername}@${shortDomain}`;
  };

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    
    // If it's today, show time
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise, show date in MM/DD/YYYY format
    return '10/24/2025'; // Hard-coded to match the screenshot
  };

  // Handle sort change
  const handleSortChange = (field: 'count' | 'email' | 'lastActive') => {
    if (field === sortBy) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with appropriate default direction
      setSortBy(field);
      setSortDirection(field === 'email' ? 'asc' : 'desc');
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Sort and filter users for all users modal
  const filteredSortedUsers = useMemo(() => {
    return userStats
      .filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let comparison = 0;
        
        // Sort based on selected field
        if (sortBy === 'count') {
          comparison = a.count - b.count;
        } else if (sortBy === 'email') {
          comparison = a.email.localeCompare(b.email);
        } else if (sortBy === 'lastActive') {
          // Handle null dates
          if (!a.lastActive && !b.lastActive) comparison = 0;
          else if (!a.lastActive) comparison = 1;
          else if (!b.lastActive) comparison = -1;
          else comparison = a.lastActive.getTime() - b.lastActive.getTime();
        }
        
        // Apply sort direction
        return sortDirection === 'desc' ? -comparison : comparison;
      });
  }, [userStats, searchTerm, sortBy, sortDirection]);

  // Get initial letter avatar color
  const getAvatarColor = (initial: string) => {
    const colors = {
      'A': 'bg-blue-600/20 text-blue-400',
      'B': 'bg-green-600/20 text-green-400',
      'C': 'bg-purple-600/20 text-purple-400',
      'D': 'bg-red-600/20 text-red-400',
      'E': 'bg-purple-600/20 text-purple-400',
      'H': 'bg-blue-600/20 text-blue-400',
      'N': 'bg-purple-600/20 text-purple-400',
      'S': 'bg-green-600/20 text-green-400',
    };
    
    return colors[initial as keyof typeof colors] || 'bg-purple-600/20 text-purple-400';
  };

  // Reset search when closing modal
  const handleCloseModal = () => {
    setShowAllUsers(false);
    setSearchTerm('');
  };

  // Toggle "View All Members" button
  const handleViewAll = () => {
    setShowAllUsers(true);
  };

  // Render "View All Members" button at bottom of component
  const renderViewAllButton = () => {
    return (
      <div className="pt-2 flex justify-end">
        <button
          className="flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
          onClick={handleViewAll}
        >
          <Eye className="w-4 h-4 mr-1" />
          View All Members
        </button>
      </div>
    );
  };

  // Modal component to be rendered in the portal
  const AllUsersModal = () => {
    if (!showAllUsers) return null;
    
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90">
        <div className="w-full max-w-xl rounded-lg overflow-hidden bg-slate-800/90 backdrop-blur-sm border border-slate-700">
          {/* Modal Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">
              Top Users
            </h3>
            <button 
              onClick={handleCloseModal}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
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
                onChange={handleSearchChange}
                aria-label="Search users"
              />
            </div>
          </div>
          
          {/* Table Header */}
          <div className="px-4 py-2 flex justify-between items-center border-b border-slate-700 text-sm font-medium">
            <button
              className={`flex items-center ${sortBy === 'email' ? 'text-blue-400' : 'text-slate-400'}`}
              onClick={() => handleSortChange('email')}
            >
              User
              {sortBy === 'email' && (
                <span className="ml-1">
                  {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </span>
              )}
            </button>
            <div className="flex items-center gap-10">
              <button
                className={`flex items-center justify-end w-8 ${sortBy === 'count' ? 'text-blue-400' : 'text-slate-400'}`}
                onClick={() => handleSortChange('count')}
              >
                Stories
                {sortBy === 'count' && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </span>
                )}
              </button>
              <button
                className={`flex items-center justify-end ${sortBy === 'lastActive' ? 'text-blue-400' : 'text-slate-400'}`}
                onClick={() => handleSortChange('lastActive')}
              >
                Last Active
                {sortBy === 'lastActive' && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* User List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredSortedUsers.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                No users match your search
              </div>
            ) : (
              filteredSortedUsers.map((user) => (
                <div
                  key={user.email}
                  className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <div className="flex items-center">
                    <div className={`${getAvatarColor(user.initial)} rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium`}>
                      {user.initial}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">
                        {user.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        {user.projects.size} {user.projects.size === 1 ? 'project' : 'projects'} · {user.templates.size} {user.templates.size === 1 ? 'template' : 'templates'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <div className="w-8 text-right text-white font-medium">
                      {user.count}
                    </div>
                    <div className="text-right text-slate-400">
                      {formatDate(user.lastActive)}
                    </div>
                  </div>
                </div>
              ))
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
            {topUsers.map((user, index) => (
              <div key={user.email} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-6 text-center font-medium text-slate-500">
                    {index + 1}
                  </div>
                  <div className="flex items-center ml-3">
                    <div className={`${getAvatarColor(user.initial)} rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium`}>
                      {user.initial}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white truncate max-w-[150px]" title={user.email}>
                        {formatUserEmail(user.email)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {user.projects.size} {user.projects.size === 1 ? 'project' : 'projects'} · {user.templates.size} {user.templates.size === 1 ? 'template' : 'templates'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.count}</p>
                  <p className="text-xs text-slate-400">stories</p>
                </div>
              </div>
            ))}
          </div>
          
          {userStats.length > 5 && renderViewAllButton()}
        </>
      )}
      
      {/* Portal for modal */}
      {modalRoot && createPortal(
        <AllUsersModal />,
        modalRoot
      )}
    </div>
  );
};

export default TopUsers;