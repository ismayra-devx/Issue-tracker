import { formatFullTimestamp, formatRelativeTime } from '../utils/formatRelativeTime';

export default function CommentList({ comments, newCommentRef }) {
  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400 italic bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
        No comments yet. Start the conversation below.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment, index) => {
        const isLast = index === comments.length - 1;
        return (
          <div
            key={comment.id}
            ref={isLast ? newCommentRef : null}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2 transition-all"
          >
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">
                {comment.author?.name || 'Unknown Author'}
              </span>
              <span
                className="text-slate-400 cursor-help"
                title={formatFullTimestamp(comment.created_at)}
              >
                {formatRelativeTime(comment.created_at)}
              </span>
            </div>

            {/* Plain text body preserving line breaks, NEVER raw HTML */}
            <p className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed break-words">
              {comment.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
