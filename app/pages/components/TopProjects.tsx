import React from 'react';
import { Folder, Users } from 'lucide-react';
import { UserStoryData } from '../types';

interface TopProjectsProps {
  data: UserStoryData[];
}

const TopProjects: React.FC<TopProjectsProps> = ({ data }) => {
  // Calculate project metrics
  const projectData: Record<string, { count: number, users: Set<string> }> = {};
  
  data.forEach(d => {
    if (d.project_name) {
      if (!projectData[d.project_name]) {
        projectData[d.project_name] = { count: 0, users: new Set() };
      }
      projectData[d.project_name].count += 1;
      if (d.user_email) {
        projectData[d.project_name].users.add(d.user_email);
      }
    }
  });
  
  const topProjects = Object.entries(projectData)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Top Projects</h3>
          <p className="text-sm text-slate-400">Most active projects by story count</p>
        </div>
        <Folder className="w-5 h-5 text-slate-400" />
      </div>
      
      {topProjects.length > 0 ? (
        <div className="space-y-3">
          {topProjects.map(([project, stats], idx) => (
            <div key={project} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-blue-400">#{idx + 1}</span>
                <div>
                  <p className="font-medium text-white truncate max-w-[200px]" title={project}>{project}</p>
                  <div className="flex items-center text-sm text-slate-400">
                    <span>{stats.count} stories</span>
                    <span className="mx-2">•</span>
                    <div className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      <span>{stats.users.size}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-400">
                  {data.length > 0 ? ((stats.count / data.length) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 text-slate-400">
          <p>No project data available</p>
        </div>
      )}
    </div>
  );
};

export default TopProjects;