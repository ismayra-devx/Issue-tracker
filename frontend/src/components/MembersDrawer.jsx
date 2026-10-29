import { useState } from 'react';
import projectsApi from '../api/projects';
import Spinner from './Spinner';

export default function MembersDrawer({
  isOpen,
  onClose,
  projectId,
  members,
  labels,
  isOwner,
  onMemberAdded,
  onLabelCreated,
}) {
  const [email, setEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Label creation state
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#6366f1');
  const [labelError, setLabelError] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);

  if (!isOpen) return null;

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError('');

    if (!email.trim()) {
      setMemberError('Email address is required.');
      return;
    }

    setAddingMember(true);
    try {
      const newMember = await projectsApi.addMember(projectId, email.trim().toLowerCase());
      onMemberAdded(newMember);
      setEmail('');
    } catch (err) {
      setMemberError(err.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    setLabelError('');

    if (!labelName.trim()) {
      setLabelError('Label name is required.');
      return;
    }

    setCreatingLabel(true);
    try {
      const newLabel = await projectsApi.createLabel(projectId, {
        name: labelName.trim(),
        color: labelColor,
      });
      onLabelCreated(newLabel);
      setLabelName('');
    } catch (err) {
      setLabelError(err.message || 'Failed to create label');
    } finally {
      setCreatingLabel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Project Members & Labels</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xl cursor-pointer"
              aria-label="Close panel"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Members Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Members ({members.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {members.map((m) => (
                  <div key={m.user_id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50/50">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.role === 'owner'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {m.role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Member Form (Owner Only) */}
            {isOwner && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Add Member by Email</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Invite an existing registered user to this project.
                </p>

                {memberError && (
                  <div
                    className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
                    role="alert"
                  >
                    {memberError}
                  </div>
                )}

                <form onSubmit={handleAddMember} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={addingMember}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {addingMember ? <Spinner size="sm" className="text-white" /> : 'Add to Project'}
                  </button>
                </form>
              </div>
            )}

            {/* Project Labels Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Labels ({labels.length})
              </h3>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {labels.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No labels created yet.</span>
                ) : (
                  labels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                      style={{
                        backgroundColor: `${l.color}15`,
                        color: l.color,
                        border: `1px solid ${l.color}40`,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                  ))
                )}
              </div>

              {/* Create Label Form (Owner Only) */}
              {isOwner && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Create New Label</h4>
                  {labelError && (
                    <div
                      className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
                      role="alert"
                    >
                      {labelError}
                    </div>
                  )}
                  <form onSubmit={handleCreateLabel} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={30}
                        placeholder="Label name (e.g. backend)"
                        value={labelName}
                        onChange={(e) => setLabelName(e.target.value)}
                        disabled={creatingLabel}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="color"
                        value={labelColor}
                        onChange={(e) => setLabelColor(e.target.value)}
                        disabled={creatingLabel}
                        className="w-12 h-[44px] p-1 rounded-lg border border-slate-300 cursor-pointer bg-white"
                        title="Choose label color"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creatingLabel}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {creatingLabel ? <Spinner size="sm" className="text-white" /> : 'Create Label'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
