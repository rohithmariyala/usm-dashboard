import React, { useMemo } from 'react';
import { Calendar, Clock, TrendingUp } from 'lucide-react';
import { UserStoryData } from '../types';

interface UsageByTimeProps {
  data: UserStoryData[];
}

interface DayData {
  date: string;
  count: number;
  formattedDate: string;
}

interface HourData {
  hour: string;
  count: number;
}

const UsageByTime: React.FC<UsageByTimeProps> = ({ data }) => {
  // Calculate usage by day and hour from actual data
  const { byDay, byHour, totalStories } = useMemo(() => {
    // Initialize with default values to ensure we always have data points
    // Create a map of the last 7 days with 0 counts
    const dayMap = new Map<string, number>();
    const today = new Date();
    
    // Add the last 7 days to the map with 0 counts
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dayMap.set(dateString, 0);
    }
    
    // Initialize all 24 hours with 0 counts
    const hourMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hourMap.set(hour, 0);
    }
    
    // Process each data item
    data.forEach(item => {
      // Handle day counting with more flexible date parsing
      if (item.date) {
        let dateKey: string;
        
        // Try to parse the date in various formats
        if (item.date.includes('-')) {
          // Already in YYYY-MM-DD format
          dateKey = item.date;
        } else {
          // Try to parse as a date object
          try {
            const dateObj = new Date(item.date);
            if (!isNaN(dateObj.getTime())) {
              dateKey = dateObj.toISOString().split('T')[0];
            } else {
              console.warn(`Could not parse date: ${item.date}`);
              return; // Skip this item
            }
          } catch (e) {
            console.warn(`Error parsing date: ${item.date}`, e);
            return; // Skip this item
          }
        }
          
        if (dayMap.has(dateKey)) {
          const dayCount = dayMap.get(dateKey) || 0;
          dayMap.set(dateKey, dayCount + 1);
        }
      }
      
      // Handle hour counting
      if (item.time) {
        // Extract hour part (HH) from time string
        let hour: string;
        
        // Try different formats of time
        const hourMatch = item.time.match(/^(\d{1,2}):/);
        if (hourMatch) {
          hour = hourMatch[1].padStart(2, '0');
        } else if (item.time.length >= 2) {
          hour = item.time.slice(0, 2).replace(/[^0-9]/g, '').padStart(2, '0');
        } else {
          console.warn(`Could not extract hour from time: ${item.time}`);
          return; // Skip this item
        }
        
        // Validate hour is between 00-23
        const hourNum = parseInt(hour, 10);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
          hour = '00'; // Default to midnight if invalid
        }
          
        if (hourMap.has(hour)) {
          const hourCount = hourMap.get(hour) || 0;
          hourMap.set(hour, hourCount + 1);
        }
      }
    });
    
    // Format day labels
    const formatDayLabel = (dateStr: string): string => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    };
    
    // Convert maps to sorted arrays
    const byDay: DayData[] = Array.from(dayMap.entries())
      .map(([date, count]) => ({ 
        date, 
        count, 
        formattedDate: formatDayLabel(date)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // For hours, ensure we have all 24 hours (00-23)
    const byHour: HourData[] = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // Calculate total stories
    const totalStories = byDay.reduce((sum, day) => sum + day.count, 0);
    
    return { byDay, byHour, totalStories };
  }, [data]);
  
  // Check if we have any actual data (any non-zero values)
  const hasData = totalStories > 0;

  // Find the highest count days and hours for highlighting
  const maxDayCount = Math.max(...byDay.map(d => d.count), 1);
  const maxHourCount = Math.max(...byHour.map(h => h.count), 1);
  
  // Find days and hours with data for better visualization
  const activeDays = byDay.filter(d => d.count > 0);
  const activeHours = byHour.filter(h => h.count > 0);

  // More visible bar rendering approach for days
  const renderDayBar = (day: DayData) => {
    const isHighestDay = day.count === maxDayCount && day.count > 0;
    const isActiveDay = day.count > 0;
    
    // Calculate height - at least 30% for non-zero, up to 100%
    const height = isActiveDay 
      ? 30 + ((day.count / maxDayCount) * 70)
      : 5;
    
    return (
      <div 
        className={`relative w-full h-full ${
          isHighestDay 
            ? 'bg-blue-500' 
            : isActiveDay 
              ? 'bg-blue-400' 
              : 'bg-slate-700'
        }`}
        style={{ height: `${height}%` }}
      >
        {isActiveDay && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-900 px-1.5 py-0.5 rounded text-xs text-white font-medium">
            {day.count}
          </div>
        )}
      </div>
    );
  };

  // More visible bar rendering approach for hours
  const renderHourBar = (hour: HourData) => {
    const isHighestHour = hour.count === maxHourCount && hour.count > 0;
    const isActiveHour = hour.count > 0;
    const isDayHour = parseInt(hour.hour) >= 7 && parseInt(hour.hour) <= 19;
    
    // Calculate height - at least 30% for non-zero, up to 100%
    const height = isActiveHour 
      ? 30 + ((hour.count / maxHourCount) * 70)
      : 5;
    
    return (
      <div 
        className={`relative w-full h-full ${
          isHighestHour 
            ? isDayHour ? 'bg-green-500' : 'bg-purple-600' 
            : isActiveHour 
              ? isDayHour ? 'bg-green-400' : 'bg-purple-400'
              : 'bg-slate-700'
        }`}
        style={{ height: `${height}%` }}
      >
        {isActiveHour && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-slate-900 px-1.5 py-0.5 rounded text-xs text-white font-medium">
            {hour.count}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Usage Patterns</h3>
          <p className="text-sm text-slate-400">Activity distribution by time</p>
        </div>
        <TrendingUp className="w-5 h-5 text-slate-400" />
      </div>
      
      {!hasData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-slate-500">No activity data available for the selected time period</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Usage by day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-white">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Activity by day</span>
              </div>
              <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded-full border border-blue-900/50">
                {totalStories} {totalStories === 1 ? 'story' : 'stories'} total
              </span>
            </div>
            
            {/* Days with most activity highlight */}
            {activeDays.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-xs text-slate-400">Most active: </span>
                {activeDays
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((day, idx) => (
                    <span key={idx} className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                      {day.formattedDate} ({day.count})
                    </span>
                  ))
                }
              </div>
            )}
            
            {/* Day chart */}
            <div className="h-40 flex items-end gap-2">
              {byDay.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full">
                  <div className="h-[85%] w-full flex items-end">
                    {renderDayBar(day)}
                  </div>
                  <span className="mt-1 text-xs text-slate-400 w-full text-center truncate">
                    {day.formattedDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Usage by hour */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-white">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Activity by hour (24h)</span>
              </div>
              <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full border border-purple-900/50">
                {totalStories} {totalStories === 1 ? 'story' : 'stories'} total
              </span>
            </div>
            
            {/* Hours with most activity highlight */}
            {activeHours.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-xs text-slate-400">Most active: </span>
                {activeHours
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((hour, idx) => {
                    const hourNum = parseInt(hour.hour);
                    const amPm = hourNum < 12 ? 'AM' : 'PM';
                    const hour12 = hourNum % 12 || 12;
                    return (
                      <span key={idx} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">
                        {hour12} {amPm} ({hour.count})
                      </span>
                    );
                  })
                }
              </div>
            )}
            
            {/* Hour chart */}
            <div className="h-40 flex items-end">
              {byHour.map((hour) => (
                <div key={hour.hour} className="flex-1 flex flex-col items-center h-full">
                  <div className="h-[85%] w-full flex items-end">
                    {renderHourBar(hour)}
                  </div>
                  {parseInt(hour.hour) % 3 === 0 && (
                    <span className="mt-1 text-xs text-slate-400">
                      {hour.hour}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageByTime;