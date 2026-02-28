"use client";

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { Environment, UserStoryData, getArtifactUrl } from '../types';

type UserTypeFilter = 'all' | 'internal' | 'actual';

interface UserRequirementsModalProps {
  userEmail: string;
  environment: Environment;
  timeWindow: string;
  customDateRange?: { from: Date | undefined; to: Date | undefined };
  internalEmails: string[];
  userTypeFilter: UserTypeFilter;
  onClose: () => void;
}

const buildTimeParams = (
  timeWindow: string,
  customDateRange?: { from: Date | undefined; to: Date | undefined }
): string => {
  const now = new Date();
  if (timeWindow === 'Custom Range' && customDateRange?.from && customDateRange?.to) {
    const toTime = new Date(customDateRange.to.getTime());
    toTime.setHours(23, 59, 59, 999);
    return `&fromTime=${customDateRange.from.toISOString()}&toTime=${toTime.toISOString()}`;
  }
  const hoursMap: Record<string, number> = {
    'Last 1 Hour': 1,
    'Last 6 Hours': 6,
    'Last 12 Hours': 12,
    'Last 24 Hours': 24,
    'Last 3 Days': 72,
    'Last 7 Days': 168,
    'Last 14 Days': 336,
    'Last 30 Days': 720,
  };
  const hours = hoursMap[timeWindow];
  if (hours) {
    const fromTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return `&fromTime=${fromTime.toISOString()}&toTime=${now.toISOString()}`;
  }
  return `&toTime=${now.toISOString()}`;
};

const PAGE_SIZE = 15;

const UserRequirementsModal: React.FC<UserRequirementsModalProps> = ({
  userEmail,
  environment,
  timeWindow,
  customDateRange,
  internalEmails,
  userTypeFilter,
  onClose,
}) => {
  const [data, setData] = useState<UserStoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchData(1);
    // close on Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [userEmail]);

  const fetchData = async (p: number) => {
    setLoading(true);
    try {
      const timeParams = buildTimeParams(timeWindow, customDateRange);
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: PAGE_SIZE,
          skip: (p - 1) * PAGE_SIZE,
          env: environment,
          timeParams,
          filters: {
            userEmail,
            internalEmails,
            userType: userTypeFilter,
            titleType: 'requirements',
          },
        }),
      });
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
      setPage(p);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white truncate max-w-[480px]" title={userEmail}>
              {userEmail}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {loading ? '…' : total} requirement{total !== 1 ? 's' : ''} generated
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mb-3" />
              <p className="text-sm">Loading requirements...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No requirements found for this user in the selected period.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {data.map((item, idx) => (
                <div
                  key={item.artifact_id || idx}
                  className="px-5 py-3.5 hover:bg-slate-700/30 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <p className="text-sm text-white truncate" title={item.artifact_title}>
                        {item.artifact_title || 'Untitled'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {item.date && (
                        <span className="text-xs text-slate-400">{item.date}{item.time ? ` · ${item.time}` : ''}</span>
                      )}
                      {item.mode_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {item.mode_name}
                        </span>
                      )}
                      {item.project_name && (
                        <span className="text-xs text-slate-500 truncate max-w-[180px]" title={item.project_name}>
                          {item.project_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.artifact_id && (
                    <a
                      href={getArtifactUrl(item.artifact_id, environment, item.mode_name || '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 shrink-0 mt-0.5"
                      title="Open artifact"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400 shrink-0">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => fetchData(page - 1)}
                className="px-3 py-1 rounded bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-white text-xs"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => fetchData(page + 1)}
                className="px-3 py-1 rounded bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-white text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserRequirementsModal;
