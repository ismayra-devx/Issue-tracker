import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import issuesApi from '../api/issues';
import Spinner from '../components/Spinner';
import { PriorityBadge, StatusBadge, TypeBadge } from '../components/Badges';

export default function IssueDetail() {
  const { projectId, number } = useParams();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadIssue() {
      try {
        const data = await issuesApi.get(projectId, number);
        if (isMounted) setIssue(data);
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load issue');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadIssue();

    return () => {
      isMounted = false;
    };
  }, [projectId, number]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 font-medium">Loading issue #{number}...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-3 text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Issue Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">{error || 'This issue could not be loaded.'}</p>
        <Link
          to={`/projects/${projectId}`}
          className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          &larr; Back to Project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          to={`/projects/${projectId}`}
          className="min-h-[44px] px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
        >
          &larr; Back to Issues
        </Link>
        <span className="text-xs text-slate-400">
          Created {new Date(issue.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
          <span className="text-lg font-bold text-slate-400">#{issue.number}</span>
          <TypeBadge type={issue.type} />
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.labels?.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${label.color}18`,
                color: label.color,
                border: `1px solid ${label.color}40`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{issue.title}</h1>

        <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-4 whitespace-pre-wrap font-sans border border-slate-100 min-h-[100px]">
          {issue.description || <span className="italic text-slate-400">No description provided.</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Reporter:</span>{' '}
            {issue.reporter?.name} ({issue.reporter?.email})
          </div>
          <div>
            <span className="font-semibold text-slate-700">Assignee:</span>{' '}
            {issue.assignee ? `${issue.assignee.name} (${issue.assignee.email})` : 'Unassigned'}
          </div>
        </div>
      </div>
    </div>
  );
}
