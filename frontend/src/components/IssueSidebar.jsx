import { useState } from 'react';
import { StatusBadge } from './Badges';
import WorkflowButtons from './WorkflowButtons';
import { formatFullTimestamp, formatRelativeTime } from '../utils/formatRelativeTime';
import Spinner from './Spinner';

export default function IssueSidebar({
  issue,
  members,
  labels,
  onPatch,
  isPatching,
}) {
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const handlePriorityChange = (e) => {
    const nextPriority = e.target.value;
    if (nextPriority !== issue.priority) {
      onPatch({ priority: nextPriority });
    }
  };

  const handleTypeChange = (e) => {
    const nextType = e.target.value;
    if (nextType !== issue.type) {
      onPatch({ type: nextType });
    }
  };

  const handleAssigneeChange = (e) => {
    const val = e.target.value;
    const nextAssigneeId = val === '' ? null : Number(val);
    if (nextAssigneeId !== (issue.assignee?.id ?? null)) {
      onPatch({ assignee_id: nextAssigneeId });
    }
  };

  const handleToggleLabel = (labelId) => {
    const currentIds = (issue.labels || []).map((l) => l.id);
    const nextIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];
    onPatch({ label_ids: nextIds });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Workflow & Status */}
      <div className="space-y-2 pb-4 border-b border-slate-100">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Status & Workflow
        </label>
        <div className="flex items-center gap-2">
          <StatusBadge status={issue.status} />
          {isPatching && <Spinner size="sm" />}
        </div>
        <div className="pt-1">
          <WorkflowButtons
            status={issue.status}
            onTransition={(targetStatus) => onPatch({ status: targetStatus })}
            disabled={isPatching}
          />
        </div>
      </div>

      {/* Priority Dropdown */}
      <div>
        <label htmlFor="sidebarPriority" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Priority
        </label>
        <select
          id="sidebarPriority"
          value={issue.priority}
          onChange={handlePriorityChange}
          disabled={isPatching}
          className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-50"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Type Dropdown */}
      <div>
        <label htmlFor="sidebarType" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Type
        </label>
        <select
          id="sidebarType"
          value={issue.type}
          onChange={handleTypeChange}
          disabled={isPatching}
          className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-50"
        >
          <option value="task">■ Task</option>
          <option value="bug">● Bug</option>
        </select>
      </div>

      {/* Assignee Dropdown */}
      <div>
        <label htmlFor="sidebarAssignee" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Assignee
        </label>
        <select
          id="sidebarAssignee"
          value={issue.assignee ? issue.assignee.id : ''}
          onChange={handleAssigneeChange}
          disabled={isPatching}
          className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-50"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
      </div>

      {/* Labels Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Labels
          </label>
          <button
            type="button"
            onClick={() => setShowLabelPicker(!showLabelPicker)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 min-h-[44px] px-2 inline-flex items-center cursor-pointer"
          >
            {showLabelPicker ? 'Done' : 'Edit Labels'}
          </button>
        </div>

        {/* Selected labels display */}
        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
          {issue.labels?.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No labels assigned</span>
          ) : (
            issue.labels?.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: `${l.color}15`,
                  color: l.color,
                  border: `1px solid ${l.color}40`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
              </span>
            ))
          )}
        </div>

        {/* Label toggle picker */}
        {showLabelPicker && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 mt-2">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">
              Toggle labels:
            </span>
            {labels.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No project labels available.</span>
            ) : (
              labels.map((l) => {
                const isSelected = (issue.labels || []).some((il) => il.id === l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleToggleLabel(l.id)}
                    disabled={isPatching}
                    className={`w-full min-h-[44px] px-3 py-2 rounded text-xs flex items-center justify-between transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-white font-semibold shadow-xs'
                        : 'bg-transparent hover:bg-white text-slate-600 border-transparent'
                    }`}
                    style={isSelected ? { borderColor: l.color, color: l.color } : {}}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                    {isSelected && <span className="font-bold">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Metadata (Reporter & Dates) */}
      <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
        <div>
          <span className="font-semibold text-slate-700">Reporter:</span>{' '}
          <span className="text-slate-900 font-medium">{issue.reporter?.name}</span>
          <div className="text-slate-400 text-[11px] truncate">{issue.reporter?.email}</div>
        </div>

        <div>
          <span className="font-semibold text-slate-700">Created:</span>{' '}
          <span
            className="cursor-help underline decoration-dotted decoration-slate-300"
            title={formatFullTimestamp(issue.created_at)}
          >
            {formatRelativeTime(issue.created_at)}
          </span>
        </div>

        <div>
          <span className="font-semibold text-slate-700">Updated:</span>{' '}
          <span
            className="cursor-help underline decoration-dotted decoration-slate-300"
            title={formatFullTimestamp(issue.updated_at)}
          >
            {formatRelativeTime(issue.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
