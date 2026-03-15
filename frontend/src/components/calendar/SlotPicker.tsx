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
      <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Keine verfügbaren Termine in den nächsten Tagen.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Date selector */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">Datum wählen</h3>
        <div className="space-y-1">
          {availableDates.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                isSameDay(date, selectedDate)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {format(date, 'EEEE, d. MMMM', { locale: de })}
              <span className="ml-2 text-xs opacity-70">
                ({slotsByDate.get(format(date, 'yyyy-MM-dd'))?.length} Slots)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slot selector */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Uhrzeit wählen — {format(selectedDate, 'd. MMMM', { locale: de })}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {currentDateSlots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onSelectSlot(slot)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                selectedSlot?.start === slot.start
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-blue-400'
              }`}
            >
              {format(parseISO(slot.start), 'HH:mm')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
