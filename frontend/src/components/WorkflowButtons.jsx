import Spinner from './Spinner';

const WORKFLOW_TRANSITIONS = {
  open: [
    {
      target: 'in_progress',
      label: 'Start progress',
      style: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
  ],
  in_progress: [
    {
      target: 'in_review',
      label: 'Send to review',
      style: 'bg-purple-600 hover:bg-purple-500 text-white',
    },
  ],
  in_review: [
    {
      target: 'closed',
      label: 'Close issue',
      style: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
  ],
  closed: [
    {
      target: 'open',
      label: 'Reopen issue',
      style: 'bg-sky-600 hover:bg-sky-500 text-white',
    },
  ],
};

export default function WorkflowButtons({ status, onTransition, disabled = false }) {
  const moves = WORKFLOW_TRANSITIONS[status] || [];

  if (moves.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {moves.map((move) => (
        <button
          key={move.target}
          type="button"
          onClick={() => onTransition(move.target)}
          disabled={disabled}
          className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${move.style}`}
        >
          {disabled ? <Spinner size="sm" className="text-white" /> : null}
          <span>{move.label} &rarr;</span>
        </button>
      ))}
    </div>
  );
}
