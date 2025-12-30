import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { UserStoryData } from '../types';

interface ActivityTimelineProps {
  data: UserStoryData[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ data }) => {
  // Group data by date to create activity timeline
  const dateActivityMap: Record<string, number> = {};
  
  // Process and group data by date
  data.forEach(item => {
    if (item.date) {
      dateActivityMap[item.date] = (dateActivityMap[item.date] || 0) + 1;
    }
  });
  
  // Convert to array for display and sort by date
  const timelineData = Object.entries(dateActivityMap)
    .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
    .slice(-7); // Show last 7 days/dates
  
  // Create hourly data (mock data for visualization)
  // In a real implementation, you would compute this from actual data
  const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    sessions: Math.floor(Math.random() * 20) + 1
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Hourly Activity Chart */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Hourly Activity</h3>
            <p className="text-sm text-slate-400">Sessions by hour of day</p>
          </div>
          <BarChart3 className="w-5 h-5 text-slate-400" />
        </div>
        
        <div className="h-48 flex items-end gap-1 mt-6">
          {hourlyActivity.slice(6, 22).map((item) => (
            <div key={item.hour} className="flex-1 flex flex-col items-center">
              <div 
                className="bg-blue-500 rounded-t w-full transition-all duration-300"
                style={{ height: `${(item.sessions / 20) * 100}%` }}
              ></div>
              <span className="text-xs text-slate-400 mt-2">{item.hour}h</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Daily Activity Timeline */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Daily Trend</h3>
            <p className="text-sm text-slate-400">Activity over time</p>
          </div>
          <TrendingUp className="w-5 h-5 text-slate-400" />
        </div>
        
        {timelineData.length > 0 ? (
          <div className="space-y-3 mt-6">
            {timelineData.map(([date, count]) => (
              <div key={date} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-white">{date}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-green-500 rounded-full" style={{ width: `${Math.min(count * 5, 100)}px` }}></div>
                  <span className="text-green-400 font-semibold">{count} stories</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-slate-400">
            <p>No timeline data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;