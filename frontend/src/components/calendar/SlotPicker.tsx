import { useState, useMemo } from 'react';
import { format, parseISO, isSameDay, addDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import type { TimeSlot } from '../../api/booking';

interface SlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  timezone: string;
}

export function SlotPicker({ slots, selectedSlot, onSelectSlot, timezone: _timezone }: SlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (slots.length > 0) return startOfDay(parseISO(slots[0].start));
    return startOfDay(new Date());
  });

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const dateKey = format(parseISO(slot.start), 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(slot);
    }
    return grouped;
  }, [slots]);

  // Get dates that have slots (next 14 days)
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(startOfDay(new Date()), i);
      const key = format(d, 'yyyy-MM-dd');
      if (slotsByDate.has(key)) dates.push(d);
    }
    return dates;
  }, [slotsByDate]);

  const currentDateSlots = slotsByDate.get(format(selectedDate, 'yyyy-MM-dd')) ?? [];

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F8FAFC]">
          <svg className="h-7 w-7 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-[#64748B]">Keine verfügbaren Termine in den nächsten Tagen.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Date selector */}
      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text, #1E293B)' }}>Datum wählen</h3>
        <div className="space-y-1.5">
          {availableDates.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 ${
                isSameDay(date, selectedDate)
                  ? 'text-white shadow-md'
                  : 'bg-white shadow-sm ring-1 ring-[#E2E8F0] hover:shadow-md'
              }`}
              style={isSameDay(date, selectedDate)
                ? { backgroundColor: 'var(--color-primary, #0B8ECA)', boxShadow: `0 4px 6px -1px rgba(var(--color-primary-rgb, 11, 142, 202), 0.25)` }
                : { color: 'var(--color-text, #1E293B)' }
              }
            >
              <span className="font-medium">{format(date, 'EEEE, d. MMMM', { locale: de })}</span>
              <span className={`ml-2 text-xs ${isSameDay(date, selectedDate) ? 'text-white/70' : 'text-[#64748B]'}`}>
                ({slotsByDate.get(format(date, 'yyyy-MM-dd'))?.length} Slots)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slot selector */}
      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text, #1E293B)' }}>
          Uhrzeit wählen — {format(selectedDate, 'd. MMMM', { locale: de })}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {currentDateSlots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onSelectSlot(slot)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                selectedSlot?.start === slot.start
                  ? 'text-white shadow-md'
                  : 'bg-white ring-1 ring-[#E2E8F0] hover:shadow-sm'
              }`}
              style={selectedSlot?.start === slot.start
                ? { backgroundColor: 'var(--color-primary, #0B8ECA)', boxShadow: `0 4px 6px -1px rgba(var(--color-primary-rgb, 11, 142, 202), 0.25)` }
                : { color: 'var(--color-text, #1E293B)' }
              }
            >
              {format(parseISO(slot.start), 'HH:mm')}
              {slot.remainingSpots !== undefined && (
                <span className="ml-2 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                  {slot.remainingSpots} {slot.remainingSpots === 1 ? 'Platz' : 'Plätze'} frei
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
