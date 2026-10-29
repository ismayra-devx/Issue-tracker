import { formatFullTimestamp, formatRelativeTime } from '../utils/formatRelativeTime';

export default function HistoryList({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400 italic bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
        No history events recorded yet.
      </div>
    );
  }

  const renderHistoryMessage = (entry) => {
    const actorName = entry.actor?.name || 'Someone';

    if (entry.field === 'created') {
      return (
        <span>
          <strong className="text-slate-800">{actorName}</strong> created this issue
        </span>
      );
    }

    const fieldLabel = entry.field.replace('_', ' ');
    const oldVal = entry.old_value || 'none';
    const newVal = entry.new_value || 'none';

    return (
      <span>
        <strong className="text-slate-800">{actorName}</strong> changed{' '}
        <span className="font-semibold text-slate-700">{fieldLabel}</span> from{' '}
        <span className="line-through text-slate-400 px-1 py-0.5 rounded bg-slate-100 text-xs">{oldVal}</span> to{' '}
        <span className="font-semibold text-indigo-700 px-1 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-xs">{newVal}</span>
      </span>
    );
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((entry, index) => {
          const isLast = index === history.length - 1;
          return (
            <li key={entry.id} className="relative pb-6">
              {!isLast && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center ring-4 ring-white text-xs font-bold text-slate-500 shrink-0">
                  {entry.field === 'created' ? '★' : '•'}
                </div>
                <div className="min-w-0 flex-1 pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm">
                  <div className="text-slate-600 leading-snug">
                    {renderHistoryMessage(entry)}
                  </div>
                  <div
                    className="text-xs text-slate-400 whitespace-nowrap cursor-help shrink-0"
                    title={formatFullTimestamp(entry.created_at)}
                  >
                    {formatRelativeTime(entry.created_at)}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

