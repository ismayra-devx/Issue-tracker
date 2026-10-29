import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import issuesApi from '../api/issues';
import projectsApi from '../api/projects';
import Spinner from '../components/Spinner';
import Toast from '../components/Toast';
import IssueSidebar from '../components/IssueSidebar';
import CommentList from '../components/CommentList';
import CommentForm from '../components/CommentForm';
import HistoryList from '../components/HistoryList';
import { StatusBadge, TypeBadge } from '../components/Badges';

export default function IssueDetail() {
  const { projectId, number } = useParams();

  // Core Data
  const [issue, setIssue] = useState(null);
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);

  // Loaders & Errors
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageError, setPageError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [isPatching, setIsPatching] = useState(false);

  // Editing state for Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // Editing state for Description
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [descTab, setDescTab] = useState('write'); // 'write' | 'preview'

  // Mobile tab state: 'comments' | 'history'
  const [mobileTab, setMobileTab] = useState('comments');

  const newCommentRef = useRef(null);

  const reloadData = useCallback(async () => {
    try {
      const [issueData, commentsData, historyData] = await Promise.all([
        issuesApi.get(projectId, number),
        issuesApi.getComments(projectId, number),
        issuesApi.getHistory(projectId, number),
      ]);
      setIssue(issueData);
      setEditTitle(issueData.title);
      setEditDesc(issueData.description || '');
      setComments(commentsData);
      setHistory(historyData);
    } catch {
      // Ignore refresh errors
    }
  }, [projectId, number]);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const [issueData, membersData, labelsData, commentsData, historyData] =
          await Promise.all([
            issuesApi.get(projectId, number),
            projectsApi.getMembers(projectId),
            projectsApi.getLabels(projectId),
            issuesApi.getComments(projectId, number),
            issuesApi.getHistory(projectId, number),
          ]);

        if (!active) return;
        setIssue(issueData);
        setEditTitle(issueData.title);
        setEditDesc(issueData.description || '');
        setMembers(membersData);
        setLabels(labelsData);
        setComments(commentsData);
        setHistory(historyData);
      } catch (err) {
        if (!active) return;
        if (err.status === 404) {
          setNotFound(true);
        } else {
          setPageError(err.message || 'Failed to load issue');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, [projectId, number]);

  // Patching helper sending ONLY the changed field
  const handlePatch = async (changes) => {
    setIsPatching(true);
    try {
      const updated = await issuesApi.update(projectId, number, changes);
      setIssue(updated);
      setEditTitle(updated.title);
      setEditDesc(updated.description || '');

      // Refresh history immediately so the new change entry appears
      const updatedHistory = await issuesApi.getHistory(projectId, number);
      setHistory(updatedHistory);

      setToastMessage('Issue updated successfully');
      setToastType('success');
    } catch (err) {
      // If PATCH fails (e.g. 400 illegal status jump), display message and refetch issue
      setToastMessage(err.message || 'Failed to update issue');
      setToastType('error');

      // Refetch issue to sync UI with server state
      await reloadData();
    } finally {
      setIsPatching(false);
    }
  };

  // Title Save
  const handleSaveTitle = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setToastMessage('Title cannot be empty');
      setToastType('error');
      return;
    }
    if (editTitle.trim() === issue.title) {
      setIsEditingTitle(false);
      return;
    }

    await handlePatch({ title: editTitle.trim() });
    setIsEditingTitle(false);
  };

  // Description Save
  const handleSaveDesc = async (e) => {
    e.preventDefault();
    const cleanDesc = editDesc.trim();
    if (cleanDesc === (issue.description || '')) {
      setIsEditingDesc(false);
      return;
    }

    await handlePatch({ description: cleanDesc || null });
    setIsEditingDesc(false);
  };

  // Comment Added handler
  const handleCommentAdded = (newComment) => {
    setComments((prev) => [...prev, newComment]);
    setToastMessage('Comment posted!');
    setToastType('success');

    // Scroll to the new comment
    setTimeout(() => {
      newCommentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 404 State
  if (notFound) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ?
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Issue Not Found</h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Issue #{number} was not found in this project, or you do not have permission to view it.
        </p>
        <Link
          to={`/projects/${projectId}`}
          className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer"
        >
          &larr; Back to Project Issues
        </Link>
      </div>
    );
  }

  // Initial loading state
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 font-medium">Loading issue #{number}...</p>
      </div>
    );
  }

  if (pageError || !issue) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
        <span>{pageError || 'Error loading issue'}</span>
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb back to project */}
      <div>
        <Link
          to={`/projects/${projectId}`}
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 min-h-[44px] w-fit"
        >
          &larr; Back to Issues
        </Link>
      </div>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xl sm:text-2xl font-bold text-slate-400">
            #{issue.number}
          </span>
          <TypeBadge type={issue.type} />
          <StatusBadge status={issue.status} />
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* MAIN COLUMN (Title, Description, Comments & History) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            {isEditingTitle ? (
              <form onSubmit={handleSaveTitle} className="space-y-3">
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isPatching}
                  className="w-full min-h-[44px] px-3.5 py-2 text-lg font-bold rounded-lg border border-indigo-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTitle(false);
                      setEditTitle(issue.title);
                    }}
                    disabled={isPatching}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPatching}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isPatching ? <Spinner size="sm" className="text-white" /> : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="group flex items-start justify-between gap-3">
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug cursor-pointer hover:text-indigo-600 transition-colors flex-1"
                  title="Click to edit title"
                >
                  {issue.title}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xs text-slate-400 group-hover:text-indigo-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer font-medium"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Description Card with Markdown Write / Preview Toggle */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </span>

              {isEditingDesc ? (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDescTab('write')}
                    className={`min-h-[38px] px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      descTab === 'write' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescTab('preview')}
                    className={`min-h-[38px] px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      descTab === 'preview' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingDesc(true);
                    setDescTab('write');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 min-h-[44px] px-3 inline-flex items-center cursor-pointer"
                >
                  Edit description
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <form onSubmit={handleSaveDesc} className="space-y-3">
                {descTab === 'write' ? (
                  <textarea
                    rows={6}
                    maxLength={10000}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    disabled={isPatching}
                    placeholder="Describe this issue using Markdown..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none min-h-[140px] p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    {editDesc.trim() ? (
                      <ReactMarkdown>{editDesc}</ReactMarkdown>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Nothing to preview.</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDesc(false);
                      setEditDesc(issue.description || '');
                    }}
                    disabled={isPatching}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPatching}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isPatching ? <Spinner size="sm" className="text-white" /> : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div
                onClick={() => {
                  setIsEditingDesc(true);
                  setDescTab('write');
                }}
                className="cursor-pointer group"
                title="Click to edit description"
              >
                {issue.description ? (
                  <div className="prose prose-sm max-w-none text-slate-800 font-sans leading-relaxed group-hover:bg-slate-50/40 p-2 rounded-lg transition-colors">
                    <ReactMarkdown>{issue.description}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic py-3 group-hover:text-indigo-600">
                    No description provided. Click to add one.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MOBILE SIDEBAR PLACEMENT (Stacks ABOVE comments on mobile) */}
          <div className="lg:hidden">
            <IssueSidebar
              issue={issue}
              members={members}
              labels={labels}
              onPatch={handlePatch}
              isPatching={isPatching}
            />
          </div>

          {/* Activity Section: Comments & History Tabs */}
          <div className="space-y-4 pt-2">
            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setMobileTab('comments')}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  mobileTab === 'comments'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Comments ({comments.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('history')}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  mobileTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                History ({history.length})
              </button>
            </div>

            {/* Tab Content */}
            {mobileTab === 'comments' ? (
              <div className="space-y-6">
                <CommentList comments={comments} newCommentRef={newCommentRef} />
                <CommentForm
                  projectId={projectId}
                  issueNumber={number}
                  onCommentAdded={handleCommentAdded}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <HistoryList history={history} />
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP SIDE COLUMN */}
        <div className="hidden lg:block sticky top-20">
          <IssueSidebar
            issue={issue}
            members={members}
            labels={labels}
            onPatch={handlePatch}
            isPatching={isPatching}
          />
        </div>
      </div>

      {/* Auto-dismiss Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}
    </div>
  );
}
