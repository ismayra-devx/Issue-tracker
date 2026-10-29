import { useEffect } from 'react';

export default function Toast({ message, type = 'error', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const bgStyles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }[type] || 'bg-slate-50 border-slate-200 text-slate-800';

  const dotStyles = {
    error: 'bg-red-500',
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
  }[type] || 'bg-slate-500';

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm w-full mx-auto p-4 rounded-lg border shadow-lg transition-all z-50 flex items-start gap-3 ${bgStyles}`}
      role="alert"
    >
      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotStyles}`} />
      <div className="flex-1 text-sm font-medium leading-relaxed">{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] -my-2 -mr-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Dismiss alert"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
      )}
    </div>
  );
}
