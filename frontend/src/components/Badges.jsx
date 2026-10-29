export function StatusBadge({ status }) {
  const configs = {
    open: { label: 'Open', style: 'bg-sky-50 text-sky-700 border-sky-200' },
    in_progress: { label: 'In Progress', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    in_review: { label: 'In Review', style: 'bg-purple-50 text-purple-700 border-purple-200' },
    closed: { label: 'Closed', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  const config = configs[status] || { label: status, style: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.style}`}
    >
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const configs = {
    low: { label: 'Low', style: 'bg-slate-100 text-slate-600 border-slate-200' },
    medium: { label: 'Medium', style: 'bg-blue-50 text-blue-700 border-blue-200' },
    high: { label: 'High', style: 'bg-orange-50 text-orange-700 border-orange-200' },
    critical: { label: 'Critical', style: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  const config = configs[priority] || { label: priority, style: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.style}`}
    >
      {config.label}
    </span>
  );
}

export function TypeBadge({ type }) {
  const isBug = type === 'bug';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
        isBug ? 'bg-rose-100/70 text-rose-800' : 'bg-indigo-100/70 text-indigo-800'
      }`}
    >
      <span>{isBug ? '● Bug' : '■ Task'}</span>
    </span>
  );
}
