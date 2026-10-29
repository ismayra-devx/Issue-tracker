import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import issuesApi from '../api/issues';
import projectsApi from '../api/projects';
import Spinner from './Spinner';

export default function NewIssueModal({
  isOpen,
  onClose,
  projectId,
  members,
  labels,
  isOwner,
  onLabelCreated,
}) {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Inline label creation state for owner
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [creatingLabel, setCreatingLabel] = useState(false);

  if (!isOpen) return null;

  const toggleLabel = (id) => {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    setCreatingLabel(true);
    try {
      const created = await projectsApi.createLabel(projectId, {
        name: newLabelName.trim(),
        color: newLabelColor,
      });
      onLabelCreated(created);
      setSelectedLabelIds((prev) => [...prev, created.id]);
      setNewLabelName('');
      setShowNewLabel(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create label');
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const issueData = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
        label_ids: selectedLabelIds,
      };

      const createdIssue = await issuesApi.create(projectId, issueData);
      onClose();
      // On success navigate to the new issue page
      navigate(`/projects/${projectId}/issues/${createdIssue.number}`);
    } catch (err) {
      setFormError(err.message || 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-10 my-6 sm:my-8">
          {/* Header */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Create New Issue</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xl cursor-pointer"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>

          {formError && (
            <div
              className="m-5 mb-0 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
              role="alert"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div className="flex-1 font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="issueTitle" className="block text-sm font-semibold text-slate-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="issueTitle"
                type="text"
                required
                maxLength={200}
                placeholder="Brief summary of the issue..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="issueType" className="block text-sm font-semibold text-slate-700 mb-1">
                  Type
                </label>
                <select
                  id="issueType"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={submitting}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="task">■ Task</option>
                  <option value="bug">● Bug</option>
                </select>
              </div>

              <div>
                <label htmlFor="issuePriority" className="block text-sm font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  id="issuePriority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={submitting}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label htmlFor="issueAssignee" className="block text-sm font-semibold text-slate-700 mb-1">
                Assignee <span className="text-xs font-normal text-slate-500">(Optional)</span>
              </label>
              <select
                id="issueAssignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={submitting}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Labels (Multi-select) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Labels <span className="text-xs font-normal text-slate-500">(Click to select)</span>
                </label>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowNewLabel(!showNewLabel)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 min-h-[44px] px-2 inline-flex items-center cursor-pointer"
                  >
                    {showNewLabel ? 'Cancel new label' : '+ New label'}
                  </button>
                )}
              </div>

              {/* Quick Label Creator */}
              {showNewLabel && isOwner && (
                <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="New label..."
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="flex-1 min-w-[120px] min-h-[44px] px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="w-11 h-[44px] p-0.5 rounded border border-slate-300 bg-white cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={handleCreateLabel}
                    disabled={creatingLabel}
                    className="min-h-[44px] px-4 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                  >
                    {creatingLabel ? '...' : 'Add'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 min-h-[44px] p-2 rounded-lg border border-slate-200 bg-slate-50/50 items-center">
                {labels.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No labels available.</span>
                ) : (
                  labels.map((l) => {
                    const isSelected = selectedLabelIds.includes(l.id);
                    return (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => toggleLabel(l.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-md text-xs font-medium cursor-pointer transition-all border ${
                          isSelected
                            ? 'ring-2 ring-indigo-500 ring-offset-1 font-semibold'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${l.color}25` : `${l.color}10`,
                          color: l.color,
                          borderColor: isSelected ? l.color : `${l.color}40`,
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                        {isSelected && <span className="font-bold ml-1">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Description (Markdown textarea) */}
            <div>
              <label htmlFor="issueDescription" className="block text-sm font-semibold text-slate-700 mb-1">
                Description <span className="text-xs font-normal text-slate-500">(Markdown supported)</span>
              </label>
              <textarea
                id="issueDescription"
                rows={4}
                maxLength={10000}
                placeholder="Detailed description, reproduction steps, or requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    <span>Creating Issue...</span>
                  </>
                ) : (
                  'Create Issue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
