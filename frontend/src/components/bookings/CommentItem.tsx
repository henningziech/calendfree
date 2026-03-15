import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentItem({ comment, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const isOwn = comment.user.id === currentUserId;
  const wasEdited = comment.updatedAt !== comment.createdAt;

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await onEdit(comment.id, editContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Kommentar wirklich löschen?')) return;
    await onDelete(comment.id);
  };

  return (
    <div className="flex gap-3">
      {comment.user.avatarUrl ? (
        <img src={comment.user.avatarUrl} className="h-8 w-8 rounded-full ring-1 ring-[#E2E8F0] shrink-0 mt-0.5" alt="" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-[#0B8ECA]/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-bold text-[#0B8ECA]">{comment.user.name.charAt(0)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#1E293B]">{comment.user.name}</span>
          <span className="text-xs text-[#64748B]">
            {format(parseISO(comment.createdAt), "d. MMM yyyy, HH:mm", { locale: de })}
            {wasEdited && ' (bearbeitet)'}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
            />
            <div className="mt-1 flex gap-2">
              <button onClick={handleSave} disabled={isSaving} className="rounded-lg bg-[#0B8ECA] px-3 py-1 text-xs font-medium text-white hover:bg-[#0874A6] disabled:opacity-50">
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
              <button onClick={() => { setIsEditing(false); setEditContent(comment.content); }} className="rounded-lg px-3 py-1 text-xs text-[#64748B] hover:text-[#1E293B]">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-[#1E293B] whitespace-pre-wrap">{comment.content}</p>
            {isOwn && (
              <div className="mt-1 flex gap-3">
                <button onClick={() => setIsEditing(true)} className="text-xs text-[#64748B] hover:text-[#0B8ECA] transition-colors">
                  Bearbeiten
                </button>
                <button onClick={handleDelete} className="text-xs text-[#64748B] hover:text-[#EF4444] transition-colors">
                  Löschen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
