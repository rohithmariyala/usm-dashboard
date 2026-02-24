"use client";

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Database } from 'lucide-react';
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

// Import components
import StatsOverview from './components/StatsOverview';
import TopProjects from './components/TopProjects';
import TopUsers from './components/TopUsers';
import DataTable from './components/DataTable';
import DayActivity from './components/DayActivity';
import CustomDateRangePicker from './components/CustomRangePicker';

// Types
import { TimeWindow, ArtifactStats, Environment } from './types';

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
      const params = new URLSearchParams();
      params.append('fromTime', fromTime.toISOString());
      params.append('toTime', toTime.toISOString());
      params.append('env', environment);
      
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
    if ((timeWindow !== 'Custom Range' || (customDateRange.from && customDateRange.to)) && activeTab === 'overview') {
      fetchAnalyticsData();
    }
  }, [environment, activeTab]); // Only automatically refresh on environment change

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Load analytics data when switching to overview tab
    if (value === 'overview' && (timeWindow !== 'Custom Range' || (customDateRange.from && customDateRange.to))) {
      fetchAnalyticsData();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-900">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              User Story Analytics Dashboard
            </h1>
            <p className="text-slate-400">
              Monitor user story generation across flows
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
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
          <TabsList className="grid w-full md:w-[400px] grid-cols-2 bg-slate-800 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Database className="mr-2 h-4 w-4" />
              Analytics
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DayActivity byDay={stats?.by_day ?? []} />
                  <TopUsers users={stats?.by_user ?? []} />
                </div>

                {/* Show empty state if no data */}
                {!stats && !loading && (
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 text-center border border-slate-700">
                    <p className="text-slate-400 text-lg">No data available for the selected time period.</p>
                  </div>
                )}
              </>
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
            />
          </TabsContent>
          
        </Tabs>
      </div>
    </div>
  );
}