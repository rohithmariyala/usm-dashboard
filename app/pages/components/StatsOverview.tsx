import React from 'react';
import { FileText, CheckCircle, Users, Target, GitBranch } from 'lucide-react';
import { ArtifactStats } from '../types';

interface StatsOverviewProps {
  summary: ArtifactStats['summary'] | null;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ summary }) => {
  const total = summary?.total ?? 0;
  const overviewPlanCount = summary?.overview_plan_count ?? 0;
  const uniqueUsers = summary?.unique_users ?? 0;
  const uniqueTemplates = summary?.unique_templates ?? 0;
  const completionRate = total > 0 ? (((summary?.success ?? total) / total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-3">
      {/* Classification summary banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-sm">
        <span className="text-slate-400">Artifact breakdown:</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">
          <FileText className="w-3.5 h-3.5" />
          {total} Generated {total === 1 ? 'Requirement' : 'Requirements'}
        </span>
        <span className="text-slate-600">+</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
          <GitBranch className="w-3.5 h-3.5" />
          {overviewPlanCount} Overview {overviewPlanCount === 1 ? 'Plan' : 'Plans'} (sub-steps)
        </span>
        <span className="ml-auto text-slate-500 text-xs italic">Analytics below reflect Generated Requirements only</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Generated Requirements */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Generated Requirements</p>
              <p className="text-3xl font-bold mt-1 text-white">{total}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-slate-500">In selected period</p>
                {overviewPlanCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    +{overviewPlanCount} plans
                  </span>
                )}
              </div>
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
    </div>
  );
};

export default StatsOverview;
