"use client";

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Database, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Import components
import StatsOverview from './components/StatsOverview';
import TopUsers from './components/TopUsers';
import DataTable from './components/DataTable';
import DayActivity from './components/DayActivity';
import CustomDateRangePicker from './components/CustomRangePicker';
import UserAnalytics from './components/UserAnalytics';
import UserRequirementsModal from './components/UserRequirementsModal';

// Types
import { TimeWindow, ArtifactStats, Environment } from './types';

type UserTypeFilter = 'all' | 'internal' | 'actual';

export default function Dashboard() {
  // State management
  const [activeTab, setActiveTab] = useState("overview");
  const [timeWindow, setTimeWindow] = useState('Last 24 Hours');
  const [stats, setStats] = useState<ArtifactStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [environment, setEnvironment] = useState<Environment>('dev');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Internal email filter state
  const [internalEmails, setInternalEmails] = useState<string[]>([]);
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('all');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // User drill-down modal state
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);

  // Load internal emails from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('usm_internal_emails');
      if (saved) {
        const parsed = JSON.parse(saved);
        setInternalEmails(parsed);
        setEmailInput(parsed.join('\n'));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveInternalEmails = () => {
    const emails = emailInput
      .split('\n')
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0);
    setInternalEmails(emails);
    localStorage.setItem('usm_internal_emails', JSON.stringify(emails));
    setShowEmailDialog(false);
  };

  // Time windows options
  const timeWindows: TimeWindow[] = [
    { label: 'Last 1 Hour', hours: 1 },
    { label: 'Last 6 Hours', hours: 6 },
    { label: 'Last 12 Hours', hours: 12 },
    { label: 'Last 24 Hours', hours: 24 },
    { label: 'Last 3 Days', days: 3 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Custom Range', custom: true },
  ];

  // Granularity mapping based on time window
  const getGranularity = (window: string, from: Date | null, to: Date | null): { unit: string; binSize: number } => {
    const map: Record<string, { unit: string; binSize: number }> = {
      'Last 1 Hour':   { unit: 'minute', binSize: 15 },
      'Last 6 Hours':  { unit: 'hour',   binSize: 1  },
      'Last 12 Hours': { unit: 'hour',   binSize: 2  },
      'Last 24 Hours': { unit: 'hour',   binSize: 4  },
      'Last 3 Days':   { unit: 'hour',   binSize: 12 },
      'Last 7 Days':   { unit: 'day',    binSize: 1  },
      'Last 14 Days':  { unit: 'day',    binSize: 1  },
      'Last 30 Days':  { unit: 'day',    binSize: 1  },
    };
    if (map[window]) return map[window];
    // Custom range: derive from duration
    if (from && to) {
      const diffHours = (to.getTime() - from.getTime()) / 3_600_000;
      if (diffHours <= 2)   return { unit: 'minute', binSize: 15 };
      if (diffHours <= 12)  return { unit: 'hour',   binSize: 1  };
      if (diffHours <= 48)  return { unit: 'hour',   binSize: 4  };
      if (diffHours <= 168) return { unit: 'hour',   binSize: 12 };
    }
    return { unit: 'day', binSize: 1 };
  };

  // Time filter function
  const getTimeFilter = (selectedWindow: string) => {
    const now = new Date();
    
    // Handle custom date range
    if (selectedWindow === 'Custom Range' && customDateRange.from && customDateRange.to) {
      // Create a copy of the date to avoid modifying the original
      const toTime = new Date(customDateRange.to);
      toTime.setHours(23, 59, 59, 999); // End of the selected day
      
      return {
        fromTime: customDateRange.from,
        toTime: toTime
      };
    }
    
    const selected = timeWindows.find(w => w.label === selectedWindow);
    
    if (!selected) {
      return { fromTime: null, toTime: now };
    }
    
    let fromTime = new Date(now);
    if (selected.hours !== undefined) {
      fromTime.setHours(now.getHours() - selected.hours);
    } else if (selected.days !== undefined) {
      fromTime.setDate(now.getDate() - selected.days);
    }

    return { fromTime, toTime: now };
  };

  // Handle time window change
  const handleTimeWindowChange = (value: string) => {
    setTimeWindow(value);
    if (value === 'Custom Range') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      // If changing from custom range to a preset, fetch data immediately
      if (timeWindow === 'Custom Range') {
        fetchAnalyticsData(value);
      }
    }
  };

  // Handle custom date range change
  const handleCustomDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);
    
    // If both dates are selected, fetch data
    if (range.from && range.to) {
      fetchAnalyticsData('Custom Range', range);
    }
  };

  // Fetch data with time filters for overview
  const fetchAnalyticsData = async (
    windowType = timeWindow, 
    dateRange = customDateRange
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const { fromTime, toTime } = windowType === 'Custom Range' 
        ? { 
            fromTime: dateRange.from, 
            toTime: dateRange.to ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)) : null 
          } 
        : getTimeFilter(windowType);
      
      if (!fromTime || !toTime) {
        throw new Error('Invalid time range');
      }
      
      // Build query parameters
      const gran = getGranularity(windowType, fromTime, toTime);
      const params = new URLSearchParams();
      params.append('fromTime', fromTime.toISOString());
      params.append('toTime', toTime.toISOString());
      params.append('env', environment);
      params.append('granularityUnit', gran.unit);
      params.append('granularityBin', gran.binSize.toString());
      if (userTypeFilter !== 'all' && internalEmails.length > 0) {
        params.append('userType', userTypeFilter);
        params.append('internalEmails', JSON.stringify(internalEmails));
      }
      
      const apiUrl = `/api/artifacts/stats?${params.toString()}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setStats(result);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle environment change
  const handleEnvironmentChange = (value: Environment) => {
    setEnvironment(value);
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    if ((timeWindow !== 'Custom Range' || (customDateRange.from && customDateRange.to)) && (activeTab === 'overview' || activeTab === 'users')) {
      fetchAnalyticsData();
    }
  }, [environment, activeTab, userTypeFilter, internalEmails]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Load analytics data when switching to overview or users tab
    if ((value === 'overview' || value === 'users') && (timeWindow !== 'Custom Range' || (customDateRange.from && customDateRange.to))) {
      fetchAnalyticsData();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-900">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Requirement AI Analytics Dashboard
            </h1>
            <p className="text-slate-400">
              Monitor requirement generation across flows
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Internal Team Email Filter */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
              {(['all', 'actual', 'internal'] as UserTypeFilter[]).map((type) => {
                const labels: Record<UserTypeFilter, string> = {
                  all: 'All Users',
                  actual: 'Actual Users',
                  internal: 'Internal',
                };
                const isActive = userTypeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => { setUserTypeFilter(type); }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      isActive
                        ? type === 'actual'
                          ? 'bg-green-600 text-white'
                          : type === 'internal'
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>

            {/* Manage Internal Emails Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowEmailDialog(true); setEmailInput(internalEmails.join('\n')); }}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              Team Emails
              {internalEmails.length > 0 && (
                <span className="ml-1 bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded-full">
                  {internalEmails.length}
                </span>
              )}
            </Button>

            {/* Environment Selector */}
            <Select value={environment} onValueChange={handleEnvironmentChange}>
              <SelectTrigger className="w-28 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="dev" className="focus:bg-slate-700 focus:text-white">
                  Dev
                </SelectItem>
                <SelectItem value="prod" className="focus:bg-slate-700 focus:text-white">
                  Prod
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Time Window Selector - Only show on overview tab */}
            {activeTab === 'overview' && (
              <>
                <Select value={timeWindow} onValueChange={handleTimeWindowChange}>
                  <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select time window" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {timeWindows.map((window) => (
                      <SelectItem key={window.label} value={window.label} className="focus:bg-slate-700 focus:text-white">
                        {window.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Custom Date Range Picker */}
                {timeWindow === 'Custom Range' && (
                  <CustomDateRangePicker 
                    onDateRangeChange={handleCustomDateRangeChange}
                    open={showCustomDatePicker}
                    onOpenChange={setShowCustomDatePicker}
                  />
                )}
                
                <Button 
                  onClick={() => fetchAnalyticsData()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                
              </>
            )}
          </div>
        </div>
        
        {/* Environment and Last Updated Info */}
        {activeTab === 'overview' && lastFetched && (
          <div className="flex items-center text-sm text-slate-400">
            <Clock className="mr-1 h-4 w-4" />
            Last updated: {lastFetched.toLocaleString()}
            {environment === 'dev' ? (
              <span className="ml-2 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">Dev</span>
            ) : (
              <span className="ml-2 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-medium">Prod</span>
            )}
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="p-4 mb-4 text-sm rounded-md border border-red-600 bg-red-900/20 text-red-400">
            <p>Error: {error}</p>
          </div>
        )}
        
        <Tabs 
          defaultValue="overview" 
          value={activeTab} 
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="grid w-full md:w-[560px] grid-cols-3 bg-slate-800 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Database className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Data Table
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p>Loading analytics data...</p>
              </div>
            ) : (
              <>
                {/* Stats Overview */}
                <StatsOverview summary={stats?.summary ?? null} />

                {/* Activity Graphs */}
                {(() => {
                  const { fromTime: cFrom, toTime: cTo } = timeWindow === 'Custom Range' && customDateRange.from && customDateRange.to
                    ? { fromTime: customDateRange.from, toTime: new Date(new Date(customDateRange.to).setHours(23, 59, 59, 999)) }
                    : getTimeFilter(timeWindow);
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <DayActivity
                        byTime={stats?.by_time ?? []}
                        timeWindow={timeWindow}
                        fromTime={cFrom ?? null}
                        toTime={cTo}
                      />
                      <TopUsers users={stats?.by_user ?? []} onUserClick={setSelectedUserEmail} />
                    </div>
                  );
                })()}

                {/* Show empty state if no data */}
                {!stats && !loading && (
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 text-center border border-slate-700">
                    <p className="text-slate-400 text-lg">No data available for the selected time period.</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="users" className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p>Loading user data...</p>
              </div>
            ) : (
              <UserAnalytics
                users={stats?.by_user ?? []}
                onUserClick={setSelectedUserEmail}
                internalEmails={internalEmails}
              />
            )}
          </TabsContent>

          <TabsContent value="data">
            <DataTable
              initialData={[]}
              timeWindow={timeWindow}
              environment={environment}
              isLoading={loading}
              onRefresh={fetchAnalyticsData}
              customDateRange={customDateRange}
              internalEmails={internalEmails}
              userTypeFilter={userTypeFilter}
            />
          </TabsContent>

        </Tabs>
      </div>

      {/* Internal Emails Management Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-400" />
              Manage Internal Team Emails
            </DialogTitle>
            <p className="text-slate-400 text-sm mt-1">
              Enter email addresses of internal team members (one per line). Use the <span className="text-orange-400 font-medium">Internal</span> / <span className="text-green-400 font-medium">Actual Users</span> filter to separate their activity.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <textarea
              value={emailInput}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmailInput(e.target.value)}
              placeholder="user@company.com&#10;tester@company.com&#10;developer@company.com"
              rows={8}
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-slate-500">
              {emailInput.split('\n').filter((e: string) => e.trim().length > 0).length} email(s) configured
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={saveInternalEmails}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Requirements Modal */}
      {selectedUserEmail && (
        <UserRequirementsModal
          userEmail={selectedUserEmail}
          environment={environment}
          timeWindow={timeWindow}
          customDateRange={customDateRange}
          internalEmails={internalEmails}
          userTypeFilter={userTypeFilter}
          onClose={() => setSelectedUserEmail(null)}
        />
      )}
    </div>
  );
}