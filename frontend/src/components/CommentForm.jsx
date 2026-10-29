import { useState } from 'react';
import issuesApi from '../api/issues';
import Spinner from './Spinner';

export default function CommentForm({ projectId, issueNumber, onCommentAdded }) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEmpty = !body.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEmpty) return;
    setError('');
    setSubmitting(true);

    try {
      const newComment = await issuesApi.addComment(projectId, issueNumber, body.trim());
      setBody('');
      onCommentAdded(newComment);
    } catch (err) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
      <label htmlFor="commentBody" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
        Leave a comment
      </label>

      {error && (
        <div
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
          role="alert"
        >
          {error}
        </div>
      )}

      <textarea
        id="commentBody"
        rows={3}
        maxLength={5000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={submitting}
        placeholder="Add thoughts, questions, or updates..."
        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 transition-colors"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || isEmpty}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {submitting ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>Posting...</span>
            </>
          ) : (
            'Comment'
          )}
        </button>
      </div>
    </form>
  );
}
