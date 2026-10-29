import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import issuesApi from '../api/issues';
import projectsApi from '../api/projects';
import useAuth from '../context/useAuth';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import { PriorityBadge, StatusBadge, TypeBadge } from '../components/Badges';
import MembersDrawer from '../components/MembersDrawer';
import NewIssueModal from '../components/NewIssueModal';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Core Data
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [issuesData, setIssuesData] = useState({ items: [], total: 0, page: 1, page_size: 20 });

  // Loaders & Errors
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [issuesError, setIssuesError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals & Panels
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);

  // URL Query Filters
  const currentStatus = searchParams.get('status') || '';
  const currentPriority = searchParams.get('priority') || '';
  const currentType = searchParams.get('type') || '';
  const currentAssignee = searchParams.get('assignee_id') || '';
  const currentLabel = searchParams.get('label_id') || '';
  const currentQ = searchParams.get('q') || '';
  const currentSort = searchParams.get('sort') || 'created_at';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const currentPageSize = parseInt(searchParams.get('page_size') || '20', 10);

  // Local state for search input to allow debouncing (syncing on change)
  const [prevQ, setPrevQ] = useState(currentQ);
  const [searchTerm, setSearchTerm] = useState(currentQ);
  if (currentQ !== prevQ) {
    setPrevQ(currentQ);
    setSearchTerm(currentQ);
  }

  const debounceTimerRef = useRef(null);

  // Is caller the owner?
  const isOwner = useMemo(() => {
    return user?.id === project?.owner_id;
  }, [user, project]);

  // Are any filters active?
  const hasActiveFilters = useMemo(() => {
    return !!(
      currentStatus ||
      currentPriority ||
      currentType ||
      currentAssignee ||
      currentLabel ||
      currentQ ||
      currentSort !== 'created_at' ||
      currentPage > 1
    );
  }, [
    currentStatus,
    currentPriority,
    currentType,
    currentAssignee,
    currentLabel,
    currentQ,
    currentSort,
    currentPage,
  ]);

  // Helper to update search params while resetting page to 1 on filter changes
  const updateFilter = useCallback(
    (key, value, resetPage = true) => {
      const nextParams = new URLSearchParams(searchParams);
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }

      if (resetPage) {
        nextParams.set('page', '1');
      }

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  const clearAllFilters = () => {
    const nextParams = new URLSearchParams();
    if (currentPageSize !== 20) {
      nextParams.set('page_size', String(currentPageSize));
    }
    setSearchTerm('');
    setSearchParams(nextParams);
  };

  // Search input change with 300ms debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateFilter('q', val.trim() || '');
    }, 300);
  };

  // Load Project, Members, and Labels metadata
  useEffect(() => {
    let isMounted = true;

    async function loadProjectMetadata() {
      try {
        const [projData, membersData, labelsData] = await Promise.all([
          projectsApi.getById(projectId),
          projectsApi.getMembers(projectId),
          projectsApi.getLabels(projectId),
        ]);

        if (isMounted) {
          setProject(projData);
          setMembers(membersData);
          setLabels(labelsData);
          setLoadingProject(false);
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 404) {
            setProjectNotFound(true);
          } else {
            setProjectError(err.message || 'Failed to load project');
          }
          setLoadingProject(false);
        }
      }
    }

    loadProjectMetadata();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [projectId]);

  // Load Issues on filter/page change
  useEffect(() => {
    if (projectNotFound) return;

    let isMounted = true;

    async function loadIssues() {
      try {
        const params = {
          status: currentStatus || undefined,
          priority: currentPriority || undefined,
          type: currentType || undefined,
          assignee_id: currentAssignee || undefined,
          label_id: currentLabel || undefined,
          q: currentQ || undefined,
          sort: currentSort,
          page: currentPage,
          page_size: currentPageSize,
        };

        const result = await issuesApi.list(projectId, params);
        if (isMounted) {
          setIssuesData(result);
          setLoadingIssues(false);
        }
      } catch (err) {
        if (isMounted) {
          setIssuesError(err.message || 'Failed to load issues');
          setLoadingIssues(false);
        }
      }
    }

    loadIssues();

    return () => {
      isMounted = false;
    };
  }, [
    projectId,
    projectNotFound,
    currentStatus,
    currentPriority,
    currentType,
    currentAssignee,
    currentLabel,
    currentQ,
    currentSort,
    currentPage,
    currentPageSize,
  ]);

  // 404 Project Not Found State
  if (projectNotFound) {
    return (
      <div className="py-12 px-4 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ?
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Project Not Found</h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The project you requested does not exist, or you do not have permission to view it.
        </p>
        <Link
          to="/"
          className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer"
        >
          &larr; Back to My Projects
        </Link>
      </div>
    );
  }

  // Initial loading state
  if (loadingProject) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 font-medium">Loading project...</p>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
        <span>{projectError}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-semibold underline min-h-[44px] px-2 flex items-center cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalPages = Math.ceil(issuesData.total / issuesData.page_size) || 1;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link
          to="/"
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 min-h-[36px] w-fit"
        >
          &larr; All Projects
        </Link>
      </div>

      {/* HEADER: project name, member count, Members button, New issue button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {project?.name}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isOwner
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isOwner ? 'Owner' : 'Member'}
            </span>
          </div>
          {project?.description && (
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsMembersOpen(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <span>Members</span>
            <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs bg-slate-100 font-bold text-slate-700">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewIssueOpen(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        {/* Search & Sort Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <input
              type="text"
              placeholder="Search issues by title or description..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full min-h-[44px] pl-3.5 pr-10 py-2 rounded-lg border border-slate-300 text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  updateFilter('q', '');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          <div>
            <select
              value={currentSort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="created_at">Sort: Newest First</option>
              <option value="updated_at">Sort: Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
          {/* Status */}
          <select
            value={currentStatus}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="closed">Closed</option>
          </select>

          {/* Priority */}
          <select
            value={currentPriority}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {/* Type */}
          <select
            value={currentType}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="task">Tasks</option>
            <option value="bug">Bugs</option>
          </select>

          {/* Assignee */}
          <select
            value={currentAssignee}
            onChange={(e) => updateFilter('assignee_id', e.target.value)}
            className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Assignees</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Label */}
          <select
            value={currentLabel}
            onChange={(e) => updateFilter('label_id', e.target.value)}
            className="col-span-2 sm:col-span-1 min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters pill */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Filtered view active</span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[36px] px-2 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ISSUES LIST OR ERROR */}
      {issuesError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {issuesError}
        </div>
      )}

      {loadingIssues ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 font-medium">Loading issues...</p>
        </div>
      ) : issuesData.items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No issues match your filters"
            description="Try adjusting your status, assignee, or search term to find what you are looking for."
            action={
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 cursor-pointer shadow-xs"
              >
                Clear all filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No issues yet"
            description="Track tasks, bugs, and feature requests by creating the first issue in this project."
            action={
              <button
                type="button"
                onClick={() => setIsNewIssueOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 cursor-pointer shadow-xs"
              >
                + Create First Issue
              </button>
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {/* DESKTOP TABLE (>= 768px) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-16">#</th>
                  <th scope="col" className="px-4 py-3.5">Title</th>
                  <th scope="col" className="px-3 py-3.5 w-28">Status</th>
                  <th scope="col" className="px-3 py-3.5 w-24">Priority</th>
                  <th scope="col" className="px-3 py-3.5 w-24">Type</th>
                  <th scope="col" className="px-4 py-3.5 w-36">Assignee</th>
                  <th scope="col" className="px-4 py-3.5 w-44">Labels</th>
                  <th scope="col" className="px-4 py-3.5 w-28 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {issuesData.items.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/projects/${projectId}/issues/${issue.number}`)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-400 group-hover:text-indigo-600 font-bold">
                      #{issue.number}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {issue.title}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <TypeBadge type={issue.type} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                      {issue.assignee ? (
                        <span className="font-medium">{issue.assignee.name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {issue.labels?.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium"
                            style={{
                              backgroundColor: `${l.color}15`,
                              color: l.color,
                              border: `1px solid ${l.color}40`,
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs text-slate-400">
                      {new Date(issue.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE STACKED CARDS (< 768px, NO HORIZONTAL SCROLL) */}
          <div className="md:hidden space-y-3">
            {issuesData.items.map((issue) => (
              <div
                key={issue.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${projectId}/issues/${issue.number}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/projects/${projectId}/issues/${issue.number}`);
                  }
                }}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer space-y-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{issue.number}
                    </span>
                    <TypeBadge type={issue.type} />
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(issue.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                  {issue.title}
                </h3>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    {issue.assignee ? (
                      <span>Assignee: <strong className="text-slate-700">{issue.assignee.name}</strong></span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </span>

                  {issue.labels?.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {issue.labels.slice(0, 2).map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${l.color}15`,
                            color: l.color,
                            border: `1px solid ${l.color}40`,
                          }}
                        >
                          {l.name}
                        </span>
                      ))}
                      {issue.labels.length > 2 && (
                        <span className="text-[10px] text-slate-400">
                          +{issue.labels.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION CONTROLS */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
              Showing <span className="font-semibold text-slate-900">{Math.min((currentPage - 1) * issuesData.page_size + 1, issuesData.total)}</span> to{' '}
              <span className="font-semibold text-slate-900">{Math.min(currentPage * issuesData.page_size, issuesData.total)}</span> of{' '}
              <span className="font-semibold text-slate-900">{issuesData.total}</span> issues
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => updateFilter('page', String(currentPage - 1), false)}
                disabled={currentPage <= 1}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                &larr; Previous
              </button>

              <span className="text-xs sm:text-sm font-medium text-slate-700 px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => updateFilter('page', String(currentPage + 1), false)}
                disabled={currentPage >= totalPages}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS PANEL (DRAWER) */}
      <MembersDrawer
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        projectId={projectId}
        members={members}
        labels={labels}
        isOwner={isOwner}
        onMemberAdded={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setToastMessage(`Added ${newMember.name || newMember.email} to project!`);
        }}
        onLabelCreated={(newLabel) => {
          setLabels((prev) => [...prev, newLabel]);
          setToastMessage(`Label "${newLabel.name}" created!`);
        }}
      />

      {/* NEW ISSUE MODAL */}
      <NewIssueModal
        isOpen={isNewIssueOpen}
        onClose={() => setIsNewIssueOpen(false)}
        projectId={projectId}
        members={members}
        labels={labels}
        isOwner={isOwner}
        onLabelCreated={(newLabel) => {
          setLabels((prev) => [...prev, newLabel]);
        }}
      />

      {/* Auto-dismiss Toast */}
      {toastMessage && (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage('')} />
      )}
    </div>
  );
}
