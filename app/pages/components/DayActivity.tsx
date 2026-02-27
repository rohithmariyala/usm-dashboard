import React, { useMemo, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';

type GranularityUnit = 'minute' | 'hour' | 'day';

interface GranularityConfig {
  unit: GranularityUnit;
  binSize: number;
}

interface BucketData {
  bucketDate: Date;
  count: number;
  label: { primary: string; secondary: string };
  tooltipLabel: string;
}

interface DayActivityProps {
  byTime: Array<{ bucket: string; count: number }>;
  timeWindow: string;
  fromTime: Date | null;
  toTime: Date | null;
  className?: string;
}

function getGranularity(
  timeWindow: string,
  fromTime: Date | null,
  toTime: Date | null
): GranularityConfig {
  const map: Record<string, GranularityConfig> = {
    'Last 1 Hour':   { unit: 'minute', binSize: 15 },
    'Last 6 Hours':  { unit: 'hour',   binSize: 1  },
    'Last 12 Hours': { unit: 'hour',   binSize: 2  },
    'Last 24 Hours': { unit: 'hour',   binSize: 4  },
    'Last 3 Days':   { unit: 'hour',   binSize: 12 },
    'Last 7 Days':   { unit: 'day',    binSize: 1  },
    'Last 14 Days':  { unit: 'day',    binSize: 1  },
    'Last 30 Days':  { unit: 'day',    binSize: 1  },
  };
  if (map[timeWindow]) return map[timeWindow];
  if (fromTime && toTime) {
    const diffHours = (toTime.getTime() - fromTime.getTime()) / 3_600_000;
    if (diffHours <= 2)   return { unit: 'minute', binSize: 15 };
    if (diffHours <= 12)  return { unit: 'hour',   binSize: 1  };
    if (diffHours <= 48)  return { unit: 'hour',   binSize: 4  };
    if (diffHours <= 168) return { unit: 'hour',   binSize: 12 };
  }
  return { unit: 'day', binSize: 1 };
}

function truncateToBucket(date: Date, unit: GranularityUnit, binSize: number): Date {
  const d = new Date(date);
  if (unit === 'minute') {
    d.setUTCSeconds(0, 0);
    d.setUTCMinutes(Math.floor(d.getUTCMinutes() / binSize) * binSize);
  } else if (unit === 'hour') {
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(Math.floor(d.getUTCHours() / binSize) * binSize);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return d;
}

function addGranularity(date: Date, unit: GranularityUnit, binSize: number): Date {
  const d = new Date(date);
  if (unit === 'minute') d.setUTCMinutes(d.getUTCMinutes() + binSize);
  else if (unit === 'hour') d.setUTCHours(d.getUTCHours() + binSize);
  else d.setUTCDate(d.getUTCDate() + binSize);
  return d;
}

function formatLabel(
  date: Date,
  unit: GranularityUnit,
  spansMultipleDays: boolean
): { primary: string; secondary: string } {
  if (unit === 'minute') {
    return {
      primary: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      secondary: '',
    };
  }
  if (unit === 'hour') {
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    if (spansMultipleDays) {
      return {
        primary: timeStr,
        secondary: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    }
    return { primary: timeStr, secondary: '' };
  }
  return {
    primary: date.toLocaleDateString('en-US', { weekday: 'short' }),
    secondary: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function formatTooltip(date: Date, unit: GranularityUnit, binSize: number): string {
  const end = addGranularity(date, unit, binSize);
  if (unit === 'minute') {
    const startStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr},  ${startStr} – ${endStr}`;
  }
  if (unit === 'hour') {
    const startStr = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDateStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (endDateStr !== dateStr) return `${dateStr} ${startStr} – ${endDateStr} ${endStr}`;
    return `${dateStr},  ${startStr} – ${endStr}`;
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getChartTitle(unit: GranularityUnit, binSize: number): string {
  if (unit === 'minute') return `Activity (${binSize}-min intervals)`;
  if (unit === 'hour') return binSize === 1 ? 'Hourly Activity' : `Activity (${binSize}h buckets)`;
  return 'Daily Activity';
}

function getChartSubtitle(unit: GranularityUnit, binSize: number): string {
  if (unit === 'minute') return `Grouped every ${binSize} minutes`;
  if (unit === 'hour') return `Grouped by ${binSize === 1 ? 'hour' : `${binSize} hours`}`;
  return 'Story creation by day';
}

const DayActivity: React.FC<DayActivityProps> = ({
  byTime,
  timeWindow,
  fromTime,
  toTime,
  className = '',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { buckets, totalCount, granularity } = useMemo(() => {
    const gran = getGranularity(timeWindow, fromTime, toTime);

    if (!fromTime || !toTime) {
      return { buckets: [], totalCount: 0, granularity: gran };
    }

    // Build a lookup: bucket ISO string → count
    const countByBucket = new Map<number, number>();
    byTime.forEach(({ bucket, count }) => {
      countByBucket.set(new Date(bucket).getTime(), count);
    });

    const spansMultipleDays =
      toTime.getTime() - fromTime.getTime() > 24 * 60 * 60 * 1000;

    // Generate all expected buckets for the time range
    const buckets: BucketData[] = [];
    let current = truncateToBucket(fromTime, gran.unit, gran.binSize);
    let safety = 0;

    while (current.getTime() <= toTime.getTime() && safety < 400) {
      safety++;
      buckets.push({
        bucketDate: new Date(current),
        count: countByBucket.get(current.getTime()) ?? 0,
        label: formatLabel(current, gran.unit, spansMultipleDays),
        tooltipLabel: formatTooltip(current, gran.unit, gran.binSize),
      });
      current = addGranularity(current, gran.unit, gran.binSize);
    }

    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    return { buckets, totalCount, granularity: gran };
  }, [byTime, timeWindow, fromTime, toTime]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const peakBucket = buckets.length > 0
    ? buckets.reduce((max, b) => (b.count > max.count ? b : max), buckets[0])
    : null;
  const hasData = totalCount > 0;

  // Label density: aim to show ~8 labels max
  const showEveryN = Math.max(1, Math.ceil(buckets.length / 8));

  const getBarColor = (count: number) => {
    if (count === 0) return 'bg-slate-700';
    const ratio = count / maxCount;
    if (ratio >= 1)    return 'bg-blue-500';
    if (ratio > 0.66)  return 'bg-blue-500/80';
    if (ratio > 0.33)  return 'bg-blue-500/60';
    return 'bg-blue-500/30';
  };

  const getBarHeight = (count: number) =>
    count === 0 ? 4 : 25 + (count / maxCount) * 75;

  const chartTitle = getChartTitle(granularity.unit, granularity.binSize);
  const chartSubtitle = getChartSubtitle(granularity.unit, granularity.binSize);

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{chartTitle}</h3>
          <p className="text-sm text-slate-400">{chartSubtitle}</p>
        </div>
        <Clock className="w-5 h-5 text-slate-400" />
      </div>

      {!hasData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No activity in this time period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="flex justify-between items-center">
            <span className="text-sm bg-blue-900/30 text-blue-300 px-3 py-1 rounded-full border border-blue-900/50">
              {totalCount} {totalCount === 1 ? 'story' : 'stories'} total
            </span>
            {peakBucket && peakBucket.count > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-slate-400">Peak:</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                  {peakBucket.label.primary}
                  {peakBucket.label.secondary ? ` ${peakBucket.label.secondary}` : ''}{' '}
                  ({peakBucket.count})
                </span>
              </div>
            )}
          </div>

          {/* Chart bars */}
          <div className="h-48 flex items-end gap-1 pt-2">
            {buckets.map((bucket, index) => {
              const isHovered = hoveredIndex === index;
              const showLabel = index % showEveryN === 0 || index === buckets.length - 1;

              return (
                <div
                  key={bucket.bucketDate.toISOString()}
                  className="relative flex-1 flex flex-col items-center h-full"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-600 px-3 py-2 rounded-lg text-xs shadow-xl whitespace-nowrap pointer-events-none">
                      <div className="font-semibold text-blue-300">
                        {bucket.count} {bucket.count === 1 ? 'story' : 'stories'}
                      </div>
                      <div className="text-slate-400 mt-0.5">{bucket.tooltipLabel}</div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-600" />
                    </div>
                  )}

                  {/* Bar area */}
                  <div className="w-full flex flex-col justify-end" style={{ height: 'calc(100% - 28px)' }}>
                    <div
                      className={`w-full rounded-t-sm transition-all duration-300 cursor-default ${getBarColor(bucket.count)} ${isHovered && bucket.count > 0 ? 'brightness-125' : ''}`}
                      style={{ height: `${getBarHeight(bucket.count)}%` }}
                    />
                  </div>

                  {/* Label */}
                  <div className="h-7 flex flex-col items-center justify-start pt-1 overflow-hidden w-full">
                    {showLabel && (
                      <>
                        <span className={`text-[10px] leading-none font-medium truncate ${isHovered ? 'text-blue-300' : 'text-slate-300'}`}>
                          {bucket.label.primary}
                        </span>
                        {bucket.label.secondary && (
                          <span className="text-[9px] leading-none text-slate-500 mt-0.5 truncate">
                            {bucket.label.secondary}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span className="text-xs text-slate-400">Peak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500/40 rounded-sm" />
              <span className="text-xs text-slate-400">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-slate-700 rounded-sm" />
              <span className="text-xs text-slate-400">None</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayActivity;
