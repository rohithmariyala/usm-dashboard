import React from 'react';
import { FileText, CheckCircle, Users, Target } from 'lucide-react';
import { ArtifactStats } from '../types';

interface StatsOverviewProps {
  summary: ArtifactStats['summary'] | null;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ summary }) => {
  const total = summary?.total ?? 0;
  const uniqueUsers = summary?.unique_users ?? 0;
  const uniqueTemplates = summary?.unique_templates ?? 0;
  const completionRate = total > 0 ? (((summary?.success ?? total) / total) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Stories */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total Stories</p>
            <p className="text-3xl font-bold mt-1 text-white">{total}</p>
            <p className="text-xs text-slate-500 mt-1">In selected period</p>
          </div>
          <FileText className="w-10 h-10 text-blue-400" />
        </div>
      </div>

      {/* Completion Rate */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Completion Rate</p>
            <p className="text-3xl font-bold mt-1 text-white">{completionRate}%</p>
            <div className="w-full bg-slate-700 h-1 mt-2 rounded-full">
              <div
                className="bg-green-500 h-1 rounded-full"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Active Users</p>
            <p className="text-3xl font-bold mt-1 text-white">{uniqueUsers}</p>
            <p className="text-xs text-slate-500 mt-1">Unique users</p>
          </div>
          <Users className="w-10 h-10 text-purple-400" />
        </div>
      </div>

      {/* Templates Used */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Templates Used</p>
            <p className="text-3xl font-bold mt-1 text-white">{uniqueTemplates}</p>
            <p className="text-xs text-slate-500 mt-1">Different templates</p>
          </div>
          <Target className="w-10 h-10 text-cyan-400" />
        </div>
      </div>
    </div>
  );
};

export default StatsOverview;
