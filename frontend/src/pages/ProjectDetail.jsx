import { Link, useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="min-h-[44px] px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
        >
          &larr; Back to Projects
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
          #{id}
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Project #{id} Details</h2>
        <p className="text-sm text-slate-500 mb-6">
          Issue boards, filters, and issue creation workflows for this project will be rendered here.
        </p>
        <Link
          to="/"
          className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm"
        >
          Return to Projects
        </Link>
      </div>
    </div>
  );
}
