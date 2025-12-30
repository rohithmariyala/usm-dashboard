import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, RefreshCw, Eye, Link2, ExternalLink } from 'lucide-react';
import { UserStoryData, TimeWindow, PaginationState, Environment, getArtifactUrl } from '../types';

interface DataTableProps {
  initialData: UserStoryData[];
  timeWindow: string;
  environment: Environment;
  isLoading: boolean;
  onRefresh: () => void;
  customDateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

const DataTable: React.FC<DataTableProps> = ({ 
  initialData, 
  timeWindow, 
  environment, 
  isLoading, 
  onRefresh,
  customDateRange 
}) => {
  // State management
  const [data, setData] = useState<UserStoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof UserStoryData>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UserStoryData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    status: null as string | null,
    template: null as string | null,
    search: ''
  });
  const [totalResults, setTotalResults] = useState(0);

  // Set data when initialData changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Update loading state from props
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Fetch data with pagination
  const fetchTableData = useCallback(async (page = pagination.page, pageSize = pagination.pageSize) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters for time filter
      let timeParams = '';
      if (timeWindow === 'Custom Range' && customDateRange?.from && customDateRange?.to) {
        const fromTime = customDateRange.from;
        const toTime = new Date(customDateRange.to.getTime());
        toTime.setHours(23, 59, 59, 999); // End of day
        
        timeParams = `&fromTime=${fromTime.toISOString()}&toTime=${toTime.toISOString()}`;
      } else {
        const now = new Date();
        let fromTime: Date | null = null;
        
        if (timeWindow === 'Last 1 Hour') {
          fromTime = new Date(now);
          fromTime.setHours(now.getHours() - 1);
        } else if (timeWindow === 'Last 6 Hours') {
          fromTime = new Date(now);
          fromTime.setHours(now.getHours() - 6);
        } else if (timeWindow === 'Last 12 Hours') {
          fromTime = new Date(now);
          fromTime.setHours(now.getHours() - 12);
        } else if (timeWindow === 'Last 24 Hours') {
          fromTime = new Date(now);
          fromTime.setHours(now.getHours() - 24);
        } else if (timeWindow === 'Last 3 Days') {
          fromTime = new Date(now);
          fromTime.setDate(now.getDate() - 3);
        } else if (timeWindow === 'Last 7 Days') {
          fromTime = new Date(now);
          fromTime.setDate(now.getDate() - 7);
        } else if (timeWindow === 'Last 14 Days') {
          fromTime = new Date(now);
          fromTime.setDate(now.getDate() - 14);
        } else if (timeWindow === 'Last 30 Days') {
          fromTime = new Date(now);
          fromTime.setDate(now.getDate() - 30);
        }
        
        if (fromTime) {
          timeParams = `&fromTime=${fromTime.toISOString()}&toTime=${now.toISOString()}`;
        } else {
          timeParams = `&toTime=${now.toISOString()}`;
        }
      }
      
      const response = await fetch('/api/artifacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: pageSize,
          skip: (page - 1) * pageSize,
          env: environment,
          timeParams: timeParams,
          filters: {
            status: appliedFilters.status,
            template: appliedFilters.template,
            search: appliedFilters.search
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      setData(result.data || []);
      setTotalResults(result.total || 0);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, timeWindow, environment, appliedFilters, customDateRange]);

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  // Handle refresh click
  const handleRefresh = () => {
    // Apply current filters when refreshing
    setAppliedFilters({
      status: statusFilter,
      template: templateFilter,
      search: searchTerm
    });
    onRefresh();
  };

  // Handle apply filters
  const applyFilters = () => {
    setAppliedFilters({
      status: statusFilter,
      template: templateFilter,
      search: searchTerm
    });
    setIsFilterOpen(false);
    // Reset to first page when applying filters
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
    fetchTableData(1, pagination.pageSize);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters(prev => ({
      ...prev,
      search: searchTerm
    }));
    // Reset to first page when searching
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
    fetchTableData(1, pagination.pageSize);
  };

  // Extract unique templates for filter dropdown
  const uniqueTemplates = Array.from(new Set(data.map(item => item.mode_name).filter(Boolean)));

  // Calculate pagination
  const totalPages = Math.ceil(totalResults / pagination.pageSize);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
    fetchTableData(newPage, pagination.pageSize);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({
      page: 1,
      pageSize: newPageSize,
      total: totalResults
    });
    fetchTableData(1, newPageSize);
  };

  // Status badge renderer
  const getStatusBadge = (status?: string) => {
    switch(status) {
      case 'success':
        return (
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
              Success
            </span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
              Failed
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              Pending
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
              Unknown
            </span>
          </div>
        );
    }
  };

  // Handle sort
  const handleSort = (field: keyof UserStoryData) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    
    // Update data order
    const sortedData = [...data].sort((a, b) => {
      const aValue = a[field] || '';
      const bValue = b[field] || '';
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return newDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
    
    setData(sortedData);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (data.length === 0) return;
    
    // Define headers
    const headers = [
      'Artifact ID',
      'Artifact Title',
      'Date',
      'Time',
      'User',
      'Template',
      'Project',
      'Status',
      'URL'
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
      const artifactUrl = item.artifact_id 
        ? getArtifactUrl(item.artifact_id, environment, item.mode_name || '')
        : '';
      
      const row = [
        item.artifact_id || '',
        `"${(item.artifact_title || '').replace(/"/g, '""')}"`,
        item.date || '',
        item.time || '',
        `"${(item.user_email || '').replace(/"/g, '""')}"`,
        `"${(item.mode_name || '').replace(/"/g, '""')}"`,
        `"${(item.project_name || '').replace(/"/g, '""')}"`,
        item.status || '',
        artifactUrl
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifacts_${environment}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Get artifact URL
  const getArtifactLink = (item: UserStoryData): string => {
    if (!item.artifact_id) return '#';
    return getArtifactUrl(item.artifact_id, environment, item.mode_name || '');
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search artifacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-blue-500 focus:border-blue-500"
          />
        </form>
        
        <div className="flex space-x-2">
          <div className="relative">
            <button
              className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium flex items-center"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </button>
            
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-slate-800 border border-slate-700 z-10">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="text-sm font-medium text-white">Filter by Status</p>
                  </div>
                  
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${statusFilter === null ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'}`}
                    onClick={() => setStatusFilter(null)}
                  >
                    All
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${statusFilter === 'success' ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'}`}
                    onClick={() => setStatusFilter('success')}
                  >
                    Success
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${statusFilter === 'pending' ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'}`}
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pending
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${statusFilter === 'failed' ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'}`}
                    onClick={() => setStatusFilter('failed')}
                  >
                    Failed
                  </button>
                  
                  <div className="border-t border-slate-700 mt-2 pt-2 px-4 py-2">
                    <p className="text-sm font-medium text-white">Filter by Template</p>
                  </div>
                  
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${templateFilter === null ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'}`}
                    onClick={() => setTemplateFilter(null)}
                  >
                    All Templates
                  </button>
                  
                  {uniqueTemplates.map(template => (
                    <button
                      key={template}
                      className={`w-full text-left px-4 py-2 text-sm ${templateFilter === template ? 'text-blue-400 bg-slate-700' : 'text-white hover:bg-slate-700'} truncate`}
                      onClick={() => setTemplateFilter(template ?? null)}
                    >
                      {template}
                    </button>
                  ))}
                  
                  <div className="border-t border-slate-700 mt-2 pt-2 px-4 py-2 flex justify-end">
                    <button 
                      onClick={applyFilters}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button
            className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium flex items-center"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          
          <button
            className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium flex items-center"
            onClick={exportToCSV}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>
      
      {/* Applied filters display */}
      {(appliedFilters.status || appliedFilters.template || appliedFilters.search) && (
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <span>Active filters:</span>
          {appliedFilters.status && (
            <span className="bg-slate-700 px-2 py-1 rounded-md flex items-center">
              Status: {appliedFilters.status}
              <button 
                onClick={() => {
                  setStatusFilter(null);
                  setAppliedFilters(prev => ({...prev, status: null}));
                  setPagination(prev => ({ ...prev, page: 1 }));
                  fetchTableData(1, pagination.pageSize);
                }}
                className="ml-1 text-slate-400 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          {appliedFilters.template && (
            <span className="bg-slate-700 px-2 py-1 rounded-md flex items-center">
              Template: {appliedFilters.template}
              <button 
                onClick={() => {
                  setTemplateFilter(null);
                  setAppliedFilters(prev => ({...prev, template: null}));
                  setPagination(prev => ({ ...prev, page: 1 }));
                  fetchTableData(1, pagination.pageSize);
                }}
                className="ml-1 text-slate-400 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          {appliedFilters.search && (
            <span className="bg-slate-700 px-2 py-1 rounded-md flex items-center">
              Search: {appliedFilters.search}
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setAppliedFilters(prev => ({...prev, search: ''}));
                  setPagination(prev => ({ ...prev, page: 1 }));
                  fetchTableData(1, pagination.pageSize);
                }}
                className="ml-1 text-slate-400 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          <button 
            onClick={() => {
              setStatusFilter(null);
              setTemplateFilter(null);
              setSearchTerm('');
              setAppliedFilters({status: null, template: null, search: ''});
              setPagination(prev => ({ ...prev, page: 1 }));
              fetchTableData(1, pagination.pageSize);
            }}
            className="text-blue-400 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
      
      {/* Data table */}
      <div className="rounded-lg overflow-hidden bg-[#0a1425] border border-slate-700/50">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-slate-400">Loading data...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-200">
                <thead className="text-xs uppercase bg-[#0c1b33] border-b border-slate-700/50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => handleSort('artifact_title')}
                    >
                      <div className="font-medium">
                        TITLE
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => handleSort('date')}
                    >
                      <div className="font-medium">
                        DATE
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => handleSort('user_email')}
                    >
                      <div className="font-medium">
                        USER
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => handleSort('mode_name')}
                    >
                      <div className="font-medium">
                        TEMPLATE
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => handleSort('project_name')}
                    >
                      <div className="font-medium">
                        PROJECT
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-4 cursor-pointer text-center"
                      onClick={() => handleSort('status')}
                    >
                      <div className="font-medium">
                        STATUS
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-4 text-center">
                      <div className="font-medium">
                        ACTIONS
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        {error ? (
                          <div>
                            <p className="text-red-400 mb-2">{error}</p>
                            <button
                              className="text-blue-400 hover:underline"
                              onClick={() => fetchTableData()}
                            >
                              Try again
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <p className="mb-2">No data found</p>
                            {(appliedFilters.status || appliedFilters.template || appliedFilters.search) && (
                              <button
                                className="mt-2 text-blue-400 hover:underline"
                                onClick={() => {
                                  setStatusFilter(null);
                                  setTemplateFilter(null);
                                  setSearchTerm('');
                                  setAppliedFilters({status: null, template: null, search: ''});
                                  fetchTableData(1, pagination.pageSize);
                                }}
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    data.map((item, idx) => (
                      <tr 
                        key={item.artifact_id || idx} 
                        className="border-b border-slate-800 hover:bg-slate-800/30"
                      >
                        <td className="px-6 py-4 font-medium truncate max-w-[250px]" title={item.artifact_title}>
                          {item.artifact_title || 'Untitled'}
                        </td>
                        <td className="px-6 py-4">
                          {item.date ? (
                            <div className="flex flex-col">
                              <span className="text-slate-300">{item.date}</span>
                              <span className="text-xs text-slate-500">{item.time}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">Unknown</span>
                          )}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[150px]" title={item.user_email}>
                          {item.user_email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[150px]" title={item.mode_name}>
                          {item.mode_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[150px]" title={item.project_name}>
                          {item.project_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center space-x-3">
                            {item.artifact_id ? (
                              <a
                                href={getArtifactLink(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-400 hover:text-blue-300"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : null}
                            <button 
                              onClick={() => {
                                setDetailItem(item);
                                setIsDetailOpen(true);
                              }}
                              className="inline-flex items-center text-blue-400 hover:text-blue-300"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 flex justify-between items-center border-t border-slate-800">
                <div className="text-sm text-slate-400">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1} to {Math.min(pagination.page * pagination.pageSize, totalResults)} of {totalResults} results
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page === 1}
                    className={`px-2 py-1 rounded-md ${pagination.page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-white bg-slate-700 hover:bg-slate-600'}`}
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Calculate which page numbers to show based on current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded-md ${pagination.page === pageNum ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, pagination.page + 1))}
                    disabled={pagination.page === totalPages}
                    className={`px-2 py-1 rounded-md ${pagination.page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-white bg-slate-700 hover:bg-slate-600'}`}
                  >
                    Next
                  </button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-400">Rows per page:</span>
                  <select 
                    value={pagination.pageSize.toString()} 
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-1"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Detail Modal */}
      {isDetailOpen && detailItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 truncate" title={detailItem.artifact_title}>
                  {detailItem.artifact_title || 'Untitled Story'}
                </h2>
                <p className="text-slate-400 text-sm">{detailItem.created_at}</p>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Project</p>
                  <p className="text-white">{detailItem.project_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Template</p>
                  <p className="text-white">{detailItem.mode_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">User</p>
                  <p className="text-white">{detailItem.user_email || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <p className="text-white">{getStatusBadge(detailItem.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Widget</p>
                  <p className="text-white">{detailItem.widget_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Story Type</p>
                  <p className="text-white">{detailItem.user_story_type || 'Unknown'}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <p className="text-sm text-slate-400 mb-2">Artifact IDs</p>
              <div className="flex flex-wrap gap-2">
                {detailItem.artifact_title_ids && detailItem.artifact_title_ids.length > 0 ? (
                  detailItem.artifact_title_ids.map((id, idx) => (
                    <span key={idx} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-md">
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">No IDs available</span>
                )}
              </div>
            </div>
            
            {detailItem.artifact_id && (
              <div className="mt-6">
                <p className="text-sm text-slate-400 mb-2">Artifact URL</p>
                <a
                  href={getArtifactLink(detailItem)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-400 hover:text-blue-300"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  <span className="truncate">{getArtifactLink(detailItem)}</span>
                </a>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;