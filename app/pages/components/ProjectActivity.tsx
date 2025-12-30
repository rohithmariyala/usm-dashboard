import React, { useMemo } from 'react';
import { BarChart, FolderKanban, Users } from 'lucide-react';
import { UserStoryData } from '../types';

interface ProjectActivityProps {
  data: UserStoryData[];
}

const ProjectActivity: React.FC<ProjectActivityProps> = ({ data }) => {
  // Calculate project metrics
  const projectData = useMemo(() => {
    const projectMap = new Map<string, {
      count: number;
      users: Set<string>;
      templates: Set<string>;
    }>();
    
    // Process each data item
    data.forEach(item => {
      const projectName = item.project_name || 'Unnamed Project';
      
      // Get or initialize project data
      const project = projectMap.get(projectName) || {
        count: 0,
        users: new Set<string>(),
        templates: new Set<string>()
      };
      
      // Update metrics
      project.count += 1;
      if (item.user_email) project.users.add(item.user_email);
      if (item.mode_name) project.templates.add(item.mode_name);
      
      // Store updated data
      projectMap.set(projectName, project);
    });
    
    // Convert to array and sort by count
    return Array.from(projectMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        users: data.users.size,
        templates: data.templates.size
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Find maximum count for visualization
  const maxCount = Math.max(...projectData.map(p => p.count), 1);
  
  // Check if we have any project data
  const hasData = projectData.length > 0 && projectData.some(p => p.count > 0);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Project Activity</h3>
          <p className="text-sm text-slate-400">Usage breakdown by project</p>
        </div>
        <FolderKanban className="w-5 h-5 text-slate-400" />
      </div>
      
      {!hasData ? (
        <div className="py-12 text-center">
          <p className="text-slate-500">No project activity available for the selected time period</p>
        </div>
      ) : (
        <div className="space-y-5">
          {projectData.slice(0, 8).map((project) => (
            <div key={project.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white truncate max-w-[300px]" title={project.name}>
                    {project.name}
                  </p>
                  <div className="flex items-center text-xs text-slate-400 space-x-3">
                    <span>{project.count} {project.count === 1 ? 'story' : 'stories'}</span>
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{project.users} {project.users === 1 ? 'user' : 'users'}</span>
                    </div>
                    <span>{project.templates} {project.templates === 1 ? 'template' : 'templates'}</span>
                  </div>
                </div>
                <div className="text-right text-sm text-blue-400 font-medium">
                  {data.length > 0 ? ((project.count / data.length) * 100).toFixed(1) : '0'}%
                </div>
              </div>
              
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${(project.count / maxCount) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
          
          {projectData.length > 8 && (
            <p className="text-xs text-slate-400 text-center pt-2 border-t border-slate-700/50">
              + {projectData.length - 8} more projects not shown
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectActivity;