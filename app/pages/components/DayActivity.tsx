import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { ArtifactStats } from '../types';

interface DayActivityProps {
  byDay: ArtifactStats['by_day'];
  className?: string;
}

interface DayData {
  date: string;
  count: number;
  formattedDate: string;
  weekDay: string;
}

const DayActivity: React.FC<DayActivityProps> = ({ byDay, className = '' }) => {
  const { chartDays, totalStories } = useMemo(() => {
    // Build a lookup from the API data
    const countByDate = new Map<string, number>();
    byDay.forEach(({ date, count }) => countByDate.set(date, count));

    // Always display the last 7 days
    const today = new Date();
    const chartDays: DayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      chartDays.push({
        date: dateString,
        count: countByDate.get(dateString) ?? 0,
        formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weekDay: d.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }

    const totalStories = chartDays.reduce((sum, d) => sum + d.count, 0);
    return { chartDays, totalStories };
  }, [byDay]);

  const maxDayCount = Math.max(...chartDays.map(d => d.count), 1);
  const activeDays = chartDays.filter(d => d.count > 0);
  const hasData = totalStories > 0;

  const renderDayBar = (day: DayData, index: number) => {
    const isHighestDay = day.count === maxDayCount && day.count > 0;
    const isActiveDay = day.count > 0;
    const isToday = index === chartDays.length - 1;

    const height = isActiveDay ? 30 + ((day.count / maxDayCount) * 70) : 5;

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

          <div className="h-48 flex items-end gap-3 mt-4">
            {chartDays.map((day, index) => (
              <div key={day.date} className="flex-1 flex flex-col items-center h-full">
                <div className="h-[85%] w-full flex items-end">
                  {renderDayBar(day, index)}
                </div>
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-xs font-medium text-slate-300">{day.weekDay}</span>
                  <span className="text-xs text-slate-400">{day.formattedDate}</span>
                </div>
              </div>
            ))}
          </div>

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
