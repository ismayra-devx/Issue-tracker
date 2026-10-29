import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import projectsApi from '../api/projects';
import useAuth from '../context/useAuth';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchProjects = async () => {
    setFetchError('');
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch (err) {
      setFetchError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        const data = await projectsApi.list();
        if (isMounted) setProjects(data);
      } catch (err) {
        if (isMounted) setFetchError(err.message || 'Failed to load projects');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Project name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const newProject = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setProjects((prev) => [newProject, ...prev]);
      setName('');
      setDescription('');
      setShowCreateModal(false);
      setToastMessage(`Project "${newProject.name}" created successfully!`);
    } catch (err) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Projects you belong to and manage.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner if load fails */}
      {fetchError && (
        <div
          className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-3"
          role="alert"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
          <div className="flex-1 font-medium">{fetchError}</div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchProjects();
            }}
            className="text-xs font-semibold underline hover:text-red-900 min-h-[44px] px-2 flex items-center"
          >
            Retry
          </button>
        </div>
      )}

      {/* Inline / Modal Create Form */}
      {showCreateModal && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Create New Project</h2>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setFormError('');
              }}
              className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xl cursor-pointer"
              aria-label="Close form"
            >
              &times;
            </button>
          </div>

          {formError && (
            <div
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2"
              role="alert"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div className="flex-1 font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Core Engine, Mobile App"
                disabled={submitting}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="projectDesc"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Description <span className="text-xs font-normal text-slate-500">(Optional)</span>
              </label>
              <textarea
                id="projectDesc"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose of this project..."
                disabled={submitting}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 transition-colors"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormError('');
                }}
                disabled={submitting}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    <span>Creating...</span>
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects List Content */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 font-medium">Loading your projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="You are not a member of any projects yet. Create your first project to start tracking issues."
          action={
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm cursor-pointer"
            >
              + Create First Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const isOwner = user?.id === project.owner_id;
            return (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/projects/${project.id}`);
                  }
                }}
                className="group relative bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isOwner
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isOwner ? 'Owner' : 'Member'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                    {project.description || (
                      <span className="italic text-slate-400">No description provided</span>
                    )}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Project #{project.id}</span>
                  <span className="group-hover:translate-x-0.5 transition-transform text-indigo-600 font-medium">
                    View issues &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-dismiss Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage('')}
        />
      )}
    </div>
  );
}
