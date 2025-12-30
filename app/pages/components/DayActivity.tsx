import React, { useMemo } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { UserStoryData } from '../types';

interface DayActivityProps {
  data: UserStoryData[];
  className?: string;
}

interface DayData {
  date: string;
  count: number;
  formattedDate: string;
  weekDay: string;
}

const DayActivity: React.FC<DayActivityProps> = ({ data, className = '' }) => {
  // Calculate usage by day
  const { byDay, totalStories } = useMemo(() => {
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
    });
    
    // Format day labels
    const formatDayLabel = (dateStr: string): { formattedDate: string, weekDay: string } => {
      try {
        const date = new Date(dateStr);
        return {
          formattedDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          weekDay: date.toLocaleDateString('en-US', { weekday: 'short' })
        };
      } catch (e) {
        return {
          formattedDate: dateStr,
          weekDay: ''
        };
      }
    };
    
    // Convert map to sorted array
    const byDay: DayData[] = Array.from(dayMap.entries())
      .map(([date, count]) => {
        const { formattedDate, weekDay } = formatDayLabel(date);
        return { 
          date, 
          count, 
          formattedDate,
          weekDay
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate total stories
    const totalStories = byDay.reduce((sum, day) => sum + day.count, 0);
    
    return { byDay, totalStories };
  }, [data]);
  
  // Find the highest count days for highlighting
  const maxDayCount = Math.max(...byDay.map(d => d.count), 1);
  
  // Find days with data for better visualization
  const activeDays = byDay.filter(d => d.count > 0);
  
  // Check if we have any actual data
  const hasData = totalStories > 0;

  // Bar rendering function with enhanced visualization
  const renderDayBar = (day: DayData, index: number) => {
    const isHighestDay = day.count === maxDayCount && day.count > 0;
    const isActiveDay = day.count > 0;
    const isToday = index === byDay.length - 1;
    
    // Calculate height - at least 30% for non-zero, up to 100%
    const height = isActiveDay 
      ? 30 + ((day.count / maxDayCount) * 70)
      : 5;
    
    // Enhanced color selection
    const getBarColor = () => {
      if (!isActiveDay) return 'bg-slate-700';
      if (isHighestDay) return 'bg-blue-500';
      if (day.count / maxDayCount > 0.66) return 'bg-blue-500/80';
      if (day.count / maxDayCount > 0.33) return 'bg-blue-500/60';
      return 'bg-blue-500/40';
    };
    
    return (
      <div 
        className={`relative w-full h-full ${getBarColor()} rounded-t-sm transition-all duration-300`}
        style={{ height: `${height}%` }}
      >
        {isActiveDay && (
          <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-blue-900 px-2 py-1 rounded text-xs text-white font-medium shadow-lg">
            {day.count}
          </div>
        )}
        {isToday && (
          <div className="absolute -right-1 top-0 h-full w-1 bg-blue-200/20 rounded-r-sm"></div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Daily Activity</h3>
          <p className="text-sm text-slate-400">Story creation by day</p>
        </div>
        <Calendar className="w-5 h-5 text-slate-400" />
      </div>
      
      {!hasData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-slate-500">No activity data available for the selected time period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total and most active days summary */}
          <div className="flex justify-between items-center">
            <span className="text-sm bg-blue-900/30 text-blue-300 px-3 py-1 rounded-full border border-blue-900/50">
              {totalStories} {totalStories === 1 ? 'story' : 'stories'} total
            </span>
            
            {activeDays.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Most active:</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                  {activeDays.sort((a, b) => b.count - a.count)[0]?.formattedDate} ({activeDays.sort((a, b) => b.count - a.count)[0]?.count})
                </span>
              </div>
            )}
          </div>
          
          {/* Day chart - enhanced design */}
          <div className="h-48 flex items-end gap-3 mt-4">
            {byDay.map((day, index) => (
              <div key={day.date} className="flex-1 flex flex-col items-center h-full">
                <div className="h-[85%] w-full flex items-end">
                  {renderDayBar(day, index)}
                </div>
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-xs font-medium text-slate-300">
                    {day.weekDay}
                  </span>
                  <span className="text-xs text-slate-400">
                    {day.formattedDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span className="text-xs text-slate-400">High activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500/40 rounded-sm"></div>
              <span className="text-xs text-slate-400">Low activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-slate-700 rounded-sm"></div>
              <span className="text-xs text-slate-400">No activity</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayActivity;