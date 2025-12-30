import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { UserStoryData } from '../types';

interface HourActivityProps {
  data: UserStoryData[];
  className?: string;
}

interface HourData {
  hour: string;
  count: number;
  hourFormatted: string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
}

const HourActivity: React.FC<HourActivityProps> = ({ data, className = '' }) => {
  // Calculate usage by hour
  const { byHour, totalStories, peakTime } = useMemo(() => {
    // Initialize all 24 hours with 0 counts
    const hourMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hourMap.set(hour, 0);
    }
    
    // Process each data item
    data.forEach(item => {
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

    // Format hours and categorize by time of day
    const getTimeOfDay = (hour: number): 'Morning' | 'Afternoon' | 'Evening' | 'Night' => {
      if (hour >= 6 && hour < 12) return 'Morning';
      if (hour >= 12 && hour < 18) return 'Afternoon';
      if (hour >= 18 && hour < 22) return 'Evening';
      return 'Night';
    };
    
    // Format hour for display
    const formatHour = (hour: string): string => {
      const hourNum = parseInt(hour, 10);
      const amPm = hourNum < 12 ? 'AM' : 'PM';
      const hour12 = hourNum % 12 || 12;
      return `${hour12}${amPm}`;
    };
    
    // Convert map to sorted array
    const byHour: HourData[] = Array.from(hourMap.entries())
      .map(([hour, count]) => {
        const hourNum = parseInt(hour, 10);
        return {
          hour,
          count,
          hourFormatted: formatHour(hour),
          timeOfDay: getTimeOfDay(hourNum)
        };
      })
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // Calculate total stories
    const totalStories = byHour.reduce((sum, hour) => sum + hour.count, 0);
    
    // Calculate peak time period
    const morningCount = byHour
      .filter(h => h.timeOfDay === 'Morning')
      .reduce((sum, h) => sum + h.count, 0);
      
    const afternoonCount = byHour
      .filter(h => h.timeOfDay === 'Afternoon')
      .reduce((sum, h) => sum + h.count, 0);
      
    const eveningCount = byHour
      .filter(h => h.timeOfDay === 'Evening')
      .reduce((sum, h) => sum + h.count, 0);
      
    const nightCount = byHour
      .filter(h => h.timeOfDay === 'Night')
      .reduce((sum, h) => sum + h.count, 0);
    
    const peakCounts = [
      { period: 'Morning (6AM-12PM)', count: morningCount, color: 'yellow' },
      { period: 'Afternoon (12PM-6PM)', count: afternoonCount, color: 'orange' },
      { period: 'Evening (6PM-10PM)', count: eveningCount, color: 'purple' },
      { period: 'Night (10PM-6AM)', count: nightCount, color: 'indigo' }
    ];
    
    const peakTime = peakCounts.reduce((max, current) => 
      current.count > max.count ? current : max, 
      peakCounts[0]
    );
    
    return { byHour, totalStories, peakTime };
  }, [data]);
  
  // Find the highest count hour for scaling
  const maxHourCount = Math.max(...byHour.map(h => h.count), 1);

  // Color map for time of day
  const timeOfDayColors = {
    'Morning': 'bg-yellow-500',
    'Afternoon': 'bg-orange-500',
    'Evening': 'bg-purple-500',
    'Night': 'bg-indigo-700'
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Hourly Activity</h3>
          <p className="text-sm text-slate-400">Story creation by hour (24h)</p>
        </div>
        <Clock className="w-5 h-5 text-slate-400" />
      </div>
      
      <div className="space-y-4">
        {/* Total and peak time summary */}
        <div className="flex justify-between items-center">
          <span className="text-sm bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-900/50">
            {totalStories} stories total
          </span>
          
          {peakTime && peakTime.count > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Peak time:</span>
              <span className={`text-xs bg-${peakTime.color}-500/20 text-${peakTime.color}-300 px-2 py-1 rounded-full`}>
                {peakTime.period} ({peakTime.count})
              </span>
            </div>
          )}
        </div>
        
        {/* Hour chart */}
        <div className="h-48 flex items-end gap-0.5">
          {byHour.map((hour) => {
            // Calculate bar height based on count proportion
            const heightPercentage = hour.count > 0 
              ? Math.max(5, (hour.count / maxHourCount) * 100) 
              : 0;
              
            return (
              <div key={hour.hour} className="flex-1 flex flex-col items-center">
                {hour.count > 0 && (
                  <div className="text-sm font-medium text-white mb-1">
                    {hour.count}
                  </div>
                )}
                <div className="w-full flex justify-center items-end" style={{ height: '75%' }}>
                  {hour.count > 0 && (
                    <div 
                      className={`w-full ${timeOfDayColors[hour.timeOfDay]} rounded-sm transition-all duration-300`}
                      style={{ height: `${heightPercentage}%` }}
                    ></div>
                  )}
                </div>
                {parseInt(hour.hour) % 3 === 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-400">
                      {hour.hour}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-2 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-slate-400">Morning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs text-slate-400">Afternoon</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs text-slate-400">Evening</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-700"></div>
            <span className="text-xs text-slate-400">Night</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourActivity;