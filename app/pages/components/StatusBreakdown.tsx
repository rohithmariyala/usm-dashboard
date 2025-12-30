import React from 'react';
import { CheckCircle, Clock, XCircle, PieChart } from 'lucide-react';
import { UserStoryData } from '../types';

interface StatusBreakdownProps {
  data: UserStoryData[];
}

const StatusBreakdown: React.FC<StatusBreakdownProps> = ({ data }) => {
  // Calculate stats
  const stats = {
    success: data.filter(d => d.status === 'success').length,
    failed: data.filter(d => d.status === 'failed').length,
    pending: data.filter(d => d.status === 'pending').length,
  };

  const total = data.length;
  
  // Calculate percentages for chart rendering
  const successPercent = total > 0 ? (stats.success / total) * 100 : 0;
  const pendingPercent = total > 0 ? (stats.pending / total) * 100 : 0;
  const failedPercent = total > 0 ? (stats.failed / total) * 100 : 0;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Status Distribution</h3>
        <PieChart className="w-5 h-5 text-slate-400" />
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Success */}
        <div className="bg-green-500/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs font-medium text-green-400">Success</span>
          </div>
          <p className="text-2xl font-bold text-green-400 mt-2">{stats.success}</p>
          <p className="text-xs text-green-500/70 mt-1">
            {total > 0 ? ((stats.success / total) * 100).toFixed(1) : '0'}%
          </p>
        </div>
        
        {/* Pending */}
        <div className="bg-yellow-500/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400 mt-2">{stats.pending}</p>
          <p className="text-xs text-yellow-500/70 mt-1">
            {total > 0 ? ((stats.pending / total) * 100).toFixed(1) : '0'}%
          </p>
        </div>
        
        {/* Failed */}
        <div className="bg-red-500/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-400 mt-2">{stats.failed}</p>
          <p className="text-xs text-red-500/70 mt-1">
            {total > 0 ? ((stats.failed / total) * 100).toFixed(1) : '0'}%
          </p>
        </div>
      </div>
      
      {/* Visual chart (simplified) */}
      <div className="mt-4 bg-slate-700/30 rounded-lg h-8 flex overflow-hidden">
        <div 
          className="bg-green-500 h-full" 
          style={{ width: `${successPercent}%` }}
        ></div>
        <div 
          className="bg-yellow-500 h-full" 
          style={{ width: `${pendingPercent}%` }}
        ></div>
        <div 
          className="bg-red-500 h-full" 
          style={{ width: `${failedPercent}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between text-xs text-slate-400 mt-2">
        <span>{successPercent.toFixed(1)}% Success</span>
        <span>{pendingPercent.toFixed(1)}% Pending</span>
        <span>{failedPercent.toFixed(1)}% Failed</span>
      </div>
    </div>
  );
};

export default StatusBreakdown;