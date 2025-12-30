import React from 'react';
import { Target } from 'lucide-react';
import { UserStoryData } from '../types';

interface TopTemplatesProps {
  data: UserStoryData[];
}

const TopTemplates: React.FC<TopTemplatesProps> = ({ data }) => {
  // Calculate template usage
  const templateData: Record<string, number> = {};
  
  data.forEach(d => {
    if (d.mode_name) {
      templateData[d.mode_name] = (templateData[d.mode_name] || 0) + 1;
    }
  });
  
  const topTemplates = Object.entries(templateData)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  const total = data.length;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Top Templates</h3>
          <p className="text-sm text-slate-400">Most used story templates</p>
        </div>
        <Target className="w-5 h-5 text-slate-400" />
      </div>
      
      {topTemplates.length > 0 ? (
        <div className="space-y-4">
          {topTemplates.map(([template, count]) => (
            <div key={template} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{template}</p>
                <span className="text-sm font-semibold text-blue-400">{count}</span>
              </div>
              
              <div className="w-full bg-slate-700 h-2 rounded-full">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-xs text-slate-400">
                <span>{total > 0 ? ((count / total) * 100).toFixed(1) : '0'}% of total</span>
                <span>{count} stories</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 text-slate-400">
          <p>No template data available</p>
        </div>
      )}
    </div>
  );
};

export default TopTemplates;