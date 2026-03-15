import { useState, type FormEvent } from 'react';

interface BookingFormProps {
  onSubmit: (data: { name: string; email: string; formData?: Record<string, string> }) => void;
  isSubmitting: boolean;
  eventTypeTitle: string;
  selectedTime: string;
}

export function BookingForm({ onSubmit, isSubmitting, eventTypeTitle, selectedTime }: BookingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl bg-[#0B8ECA]/5 border border-[#0B8ECA]/10 p-4">
        <p className="text-sm font-semibold text-[#0B8ECA]">{eventTypeTitle}</p>
        <p className="mt-0.5 text-sm text-[#0874A6]">{selectedTime}</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[#1E293B]">
          Name *
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
          placeholder="Max Mustermann"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[#1E293B]">
          E-Mail *
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
          placeholder="max@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#0B8ECA]/20 transition-all hover:shadow-lg hover:shadow-[#0B8ECA]/30 disabled:opacity-50"
      >
        {isSubmitting ? 'Wird gebucht...' : 'Termin buchen'}
      </button>
    </form>
  );
}
