import { useState } from 'react';
import { CommentItem } from './CommentItem';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface CommentListProps {
  comments: Comment[];
  currentUserId: string;
  onAdd: (content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentList({ comments, currentUserId, onAdd, onEdit, onDelete }: CommentListProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      await onAdd(newComment);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {comments.length > 0 ? (
        <div className="space-y-4 mb-4">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#64748B] mb-4">Noch keine Kommentare.</p>
      )}

      <div>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          placeholder="Kommentar hinzufügen..."
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[#64748B]">Cmd+Enter zum Absenden</span>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            className="rounded-lg bg-[#0B8ECA] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Wird gesendet...' : 'Kommentar'}
          </button>
        </div>
      </div>
    </div>
  );
}
