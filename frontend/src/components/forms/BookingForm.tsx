import { useState, type FormEvent } from 'react';

interface BookingFormProps {
  onSubmit: (data: { name: string; email: string; comment?: string }) => void;
  isSubmitting: boolean;
  eventTypeTitle: string;
  selectedTime: string;
  allowComment?: boolean;
  initialName?: string;
  initialEmail?: string;
}

export function BookingForm({ onSubmit, isSubmitting, eventTypeTitle, selectedTime, allowComment, initialName, initialEmail }: BookingFormProps) {
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [comment, setComment] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email, ...(comment ? { comment } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.05)',
          borderColor: 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.1)',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--color-primary, #0B8ECA)' }}>{eventTypeTitle}</p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-primary, #0B8ECA)', opacity: 0.85 }}>{selectedTime}</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium" style={{ color: 'var(--color-text, #1E293B)' }}>
          Name *
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:ring-2 focus:outline-none"
          style={{ '--tw-ring-color': 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.2)' } as React.CSSProperties}
          placeholder="Max Mustermann"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--color-text, #1E293B)' }}>
          E-Mail *
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:ring-2 focus:outline-none"
          style={{ '--tw-ring-color': 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.2)' } as React.CSSProperties}
          placeholder="max@example.com"
        />
      </div>

      {allowComment && (
        <div>
          <label htmlFor="comment" className="block text-sm font-medium" style={{ color: 'var(--color-text, #1E293B)' }}>
            Nachricht <span className="text-[#64748B] font-normal">(optional)</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-1.5 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:ring-2 focus:outline-none resize-none"
            style={{ '--tw-ring-color': 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.2)' } as React.CSSProperties}
            placeholder="Gibt es etwas, das wir im Vorfeld wissen sollten?"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
        style={{
          backgroundImage: `linear-gradient(to right, var(--color-primary, #0B8ECA), var(--color-accent, #14B8A6))`,
          boxShadow: `0 4px 6px -1px rgba(var(--color-primary-rgb, 11, 142, 202), 0.2)`,
        }}
      >
        {isSubmitting ? 'Wird gebucht...' : 'Termin buchen'}
      </button>
    </form>
  );
}
