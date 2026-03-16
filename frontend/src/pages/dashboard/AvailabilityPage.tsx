import { useState, useEffect } from 'react';
import { getMyProfile, updateMyAvailability, updateMyTimezone, getHolidays } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

/** Day definitions starting with Sunday (Calendly-style). */
const DAYS = [
  { key: 'sunday', short: 'S', label: 'Sonntag' },
  { key: 'monday', short: 'M', label: 'Montag' },
  { key: 'tuesday', short: 'D', label: 'Dienstag' },
  { key: 'wednesday', short: 'M', label: 'Mittwoch' },
  { key: 'thursday', short: 'D', label: 'Donnerstag' },
  { key: 'friday', short: 'F', label: 'Freitag' },
  { key: 'saturday', short: 'S', label: 'Samstag' },
] as const;

const DEFAULT_SLOT = { start: '09:00', end: '17:00' };

const TIMEZONES = [
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const HOLIDAY_COUNTRIES = [
  { code: 'de', label: 'Deutschland' },
  { code: 'at', label: 'Österreich' },
  { code: 'ch', label: 'Schweiz' },
  { code: 'gb', label: 'Vereinigtes Königreich' },
  { code: 'us', label: 'USA' },
];

interface TimeSlot {
  start: string;
  end: string;
}

interface Holiday {
  name: string;
  date: string;
  countryCode: string;
}

type WeeklySchedule = Record<string, TimeSlot[]>;

// ─── Copy Popover ──────────────────────────────────────────────────────────────

/** Popover to copy a day's time ranges to other days. */
function CopyPopover({
  sourceDayKey,
  schedule,
  onApply,
  onClose,
}: {
  sourceDayKey: string;
  schedule: WeeklySchedule;
  onApply: (targetKeys: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = DAYS.filter((d) => d.key !== sourceDayKey).map((d) => d.key);
    setSelected(new Set(allKeys));
  };

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-[#64748B]">Zeiten kopieren nach:</p>
      <button onClick={selectAll} className="mb-2 text-xs text-[#0B8ECA] hover:underline">
        Alle auswählen
      </button>
      {DAYS.filter((d) => d.key !== sourceDayKey).map((d) => (
        <label key={d.key} className="flex items-center gap-2 py-0.5 text-sm text-[#1E293B]">
          <input
            type="checkbox"
            checked={selected.has(d.key)}
            onChange={() => toggle(d.key)}
            className="accent-[#0B8ECA]"
          />
          {d.label}
        </label>
      ))}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => { onApply(Array.from(selected)); onClose(); }}
          disabled={selected.size === 0}
          className="rounded-lg bg-[#0B8ECA] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Übernehmen
        </button>
        <button onClick={onClose} className="rounded-lg px-3 py-1 text-xs text-[#64748B] hover:bg-[#F1F5F9]">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─── Schedules Tab ─────────────────────────────────────────────────────────────

/** Format date string in German locale. */
function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

type DateSpecificHours = Record<string, TimeSlot[]>;

function SchedulesTab({
  schedule,
  timezone,
  dateSpecificHours,
  onScheduleChange,
  onTimezoneChange,
  onDateSpecificHoursChange,
}: {
  schedule: WeeklySchedule;
  timezone: string;
  dateSpecificHours: DateSpecificHours;
  onScheduleChange: (s: WeeklySchedule) => void;
  onTimezoneChange: (tz: string) => void;
  onDateSpecificHoursChange: (dsh: DateSpecificHours) => void;
}) {
  const [copyDay, setCopyDay] = useState<string | null>(null);
  const [dshFormOpen, setDshFormOpen] = useState(false);
  const [dshDate, setDshDate] = useState('');
  const [dshSlots, setDshSlots] = useState<TimeSlot[]>([{ ...DEFAULT_SLOT }]);

  /** Toggle a day on/off. */
  const toggleDay = (dayKey: string) => {
    const slots = schedule[dayKey] ?? [];
    const next = { ...schedule };
    next[dayKey] = slots.length > 0 ? [] : [{ ...DEFAULT_SLOT }];
    onScheduleChange(next);
  };

  /** Update a specific slot field. */
  const updateSlot = (dayKey: string, idx: number, field: 'start' | 'end', value: string) => {
    const next = { ...schedule };
    const slots = [...(next[dayKey] ?? [])];
    slots[idx] = { ...slots[idx], [field]: value };
    next[dayKey] = slots;
    onScheduleChange(next);
  };

  /** Remove a time range. If last one, disable the day. */
  const removeSlot = (dayKey: string, idx: number) => {
    const next = { ...schedule };
    const slots = [...(next[dayKey] ?? [])];
    slots.splice(idx, 1);
    next[dayKey] = slots;
    onScheduleChange(next);
  };

  /** Add another time range to a day. */
  const addSlot = (dayKey: string) => {
    const next = { ...schedule };
    const slots = [...(next[dayKey] ?? [])];
    const lastEnd = slots.length > 0 ? slots[slots.length - 1].end : '09:00';
    slots.push({ start: lastEnd, end: '17:00' });
    next[dayKey] = slots;
    onScheduleChange(next);
  };

  /** Copy time ranges from one day to selected targets. */
  const copyToTargets = (sourceKey: string, targetKeys: string[]) => {
    const sourceSlots = schedule[sourceKey] ?? [];
    const next = { ...schedule };
    targetKeys.forEach((key) => {
      next[key] = sourceSlots.map((s) => ({ ...s }));
    });
    onScheduleChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Weekly hours */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
          Arbeitszeiten (Standard)
        </h3>

        <div className="mt-4 space-y-3">
          {DAYS.map((day) => {
            const slots = schedule[day.key] ?? [];
            const isAvailable = slots.length > 0;

            return (
              <div key={day.key} className="relative">
                <div className="flex items-start gap-3">
                  {/* Day circle */}
                  <button
                    onClick={() => toggleDay(day.key)}
                    title={day.label}
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white transition-colors ${
                      isAvailable ? 'bg-[#0B8ECA]' : 'bg-[#64748B]'
                    }`}
                  >
                    {day.short}
                  </button>

                  {/* Slots or "Nicht verfügbar" */}
                  <div className="flex-1">
                    {!isAvailable ? (
                      <p className="mt-1.5 text-sm text-[#94A3B8]">Nicht verfügbar</p>
                    ) : (
                      <div className="space-y-1.5">
                        {slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(day.key, idx, 'start', e.target.value)}
                              className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                            />
                            <span className="text-[#64748B]">–</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(day.key, idx, 'end', e.target.value)}
                              className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                            />
                            {/* Remove slot */}
                            <button
                              onClick={() => removeSlot(day.key, idx)}
                              className="text-[#94A3B8] hover:text-red-500"
                              title="Zeitfenster entfernen"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        {/* Add slot + Copy */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => addSlot(day.key)}
                            className="text-xs text-[#0B8ECA] hover:underline"
                            title="Weiteres Zeitfenster hinzufügen"
                          >
                            + Zeitfenster
                          </button>
                          <button
                            onClick={() => setCopyDay(copyDay === day.key ? null : day.key)}
                            className="text-[#94A3B8] hover:text-[#0B8ECA]"
                            title="Zeiten kopieren"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Copy popover */}
                {copyDay === day.key && (
                  <CopyPopover
                    sourceDayKey={day.key}
                    schedule={schedule}
                    onApply={(targets) => copyToTargets(day.key, targets)}
                    onClose={() => setCopyDay(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date-specific hours */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
              Datumsabhängige Stunden
            </h3>
            <p className="mt-1 text-xs text-[#94A3B8]">Passe Verfügbarkeit für bestimmte Tage an</p>
          </div>
          {!dshFormOpen && (
            <button
              onClick={() => {
                setDshDate('');
                setDshSlots([{ ...DEFAULT_SLOT }]);
                setDshFormOpen(true);
              }}
              className="text-sm text-[#0B8ECA] hover:underline"
            >
              + Stunden
            </button>
          )}
        </div>

        {/* Inline add form */}
        {dshFormOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div>
              <label className="block text-xs font-medium text-[#1E293B]">Datum</label>
              <input
                type="date"
                value={dshDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDshDate(e.target.value)}
                className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B]">Zeitfenster</label>
              <div className="mt-1 space-y-1.5">
                {dshSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => {
                        const next = [...dshSlots];
                        next[idx] = { ...next[idx], start: e.target.value };
                        setDshSlots(next);
                      }}
                      className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                    />
                    <span className="text-[#64748B]">–</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => {
                        const next = [...dshSlots];
                        next[idx] = { ...next[idx], end: e.target.value };
                        setDshSlots(next);
                      }}
                      className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                    />
                    {dshSlots.length > 1 && (
                      <button
                        onClick={() => setDshSlots(dshSlots.filter((_, i) => i !== idx))}
                        className="text-[#94A3B8] hover:text-red-500"
                        title="Zeitfenster entfernen"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const lastEnd = dshSlots.length > 0 ? dshSlots[dshSlots.length - 1].end : '09:00';
                    setDshSlots([...dshSlots, { start: lastEnd, end: '17:00' }]);
                  }}
                  className="text-xs text-[#0B8ECA] hover:underline"
                >
                  + Zeitfenster
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!dshDate) return;
                  onDateSpecificHoursChange({ ...dateSpecificHours, [dshDate]: dshSlots });
                  setDshFormOpen(false);
                }}
                disabled={!dshDate}
                className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Hinzufügen
              </button>
              <button
                onClick={() => setDshFormOpen(false)}
                className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B]"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Existing entries */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const futureDates = Object.keys(dateSpecificHours)
            .filter((d) => d >= today && dateSpecificHours[d].length > 0)
            .sort();
          if (futureDates.length === 0) return null;
          return (
            <div className="mt-4 space-y-2">
              {futureDates.map((date) => (
                <div key={date} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#F8FAFC]">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{formatDateDE(date)}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {dateSpecificHours[date].map((s) => `${s.start}–${s.end}`).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const { [date]: _, ...rest } = dateSpecificHours;
                      onDateSpecificHoursChange(rest);
                    }}
                    className="text-[#EF4444] hover:text-red-700"
                    title="Eintrag löschen"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Timezone */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-[#1E293B]">Zeitzone</label>
        <select
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Advanced Settings Tab ─────────────────────────────────────────────────────

function AdvancedSettingsTab({
  maxPerDay,
  maxPerWeek,
  holidayCountry,
  blockedHolidays,
  onMaxPerDayChange,
  onMaxPerWeekChange,
  onHolidayCountryChange,
  onBlockedHolidaysChange,
}: {
  maxPerDay: number | null;
  maxPerWeek: number | null;
  holidayCountry: string;
  blockedHolidays: string[];
  onMaxPerDayChange: (v: number | null) => void;
  onMaxPerWeekChange: (v: number | null) => void;
  onHolidayCountryChange: (c: string) => void;
  onBlockedHolidaysChange: (h: string[]) => void;
}) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [hidePast, setHidePast] = useState(true);
  const [holidayPage, setHolidayPage] = useState(0);
  const HOLIDAYS_PER_PAGE = 10;

  /** Load holidays when country changes. */
  useEffect(() => {
    let cancelled = false;
    setHolidaysLoading(true);
    setHolidaysError(null);
    getHolidays(holidayCountry)
      .then((data) => { if (!cancelled) setHolidays(data); })
      .catch((err) => { if (!cancelled) setHolidaysError(err.message ?? 'Fehler beim Laden'); })
      .finally(() => { if (!cancelled) setHolidaysLoading(false); });
    return () => { cancelled = true; };
  }, [holidayCountry]);

  /** Toggle a holiday date in the blocked list. */
  const toggleHoliday = (date: string) => {
    if (blockedHolidays.includes(date)) {
      onBlockedHolidaysChange(blockedHolidays.filter((d) => d !== date));
    } else {
      onBlockedHolidaysChange([...blockedHolidays, date]);
    }
  };

  /** Format an ISO date string for display. */
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Appointment limits */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
          Termin-Limits
        </h3>
        <div className="mt-4 flex gap-8">
          <div>
            <label className="block text-sm text-[#1E293B]">Max. pro Tag</label>
            <input
              type="number"
              value={maxPerDay ?? ''}
              onChange={(e) => onMaxPerDayChange(e.target.value ? Number(e.target.value) : null)}
              min={1}
              max={50}
              placeholder="–"
              className="mt-1 w-24 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-[#1E293B]">Max. pro Woche</label>
            <input
              type="number"
              value={maxPerWeek ?? ''}
              onChange={(e) => onMaxPerWeekChange(e.target.value ? Number(e.target.value) : null)}
              min={1}
              max={200}
              placeholder="–"
              className="mt-1 w-24 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Holidays */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
          Feiertage
        </h3>

        {/* Country selector */}
        <div className="mt-3">
          <label className="block text-sm text-[#1E293B]">Land</label>
          <select
            value={holidayCountry}
            onChange={(e) => onHolidayCountryChange(e.target.value)}
            className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            {HOLIDAY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Info banner */}
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#0B8ECA]/5 px-3 py-2">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#0B8ECA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-xs text-[#0B8ECA]">
            Feiertage werden automatisch über den Google Kalender abgerufen.
          </p>
        </div>

        {/* Hide past toggle */}
        <div className="mt-3 flex items-center justify-between">
          <label className="text-sm text-[#64748B]">Vergangene Feiertage ausblenden</label>
          <button
            onClick={() => { setHidePast(!hidePast); setHolidayPage(0); }}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              hidePast ? 'bg-[#0B8ECA]' : 'bg-[#E2E8F0]'
            }`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                hidePast ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Holiday list */}
        <div className="mt-4">
          {holidaysLoading && (
            <p className="text-sm text-[#94A3B8]">Feiertage werden geladen...</p>
          )}

          {holidaysError && (
            <p className="text-sm text-red-500">Fehler: {holidaysError}</p>
          )}

          {!holidaysLoading && !holidaysError && (() => {
            const today = new Date().toISOString().split('T')[0];
            const filtered = hidePast ? holidays.filter((h) => h.date >= today) : holidays;
            const totalPages = Math.ceil(filtered.length / HOLIDAYS_PER_PAGE);
            const pageHolidays = filtered.slice(holidayPage * HOLIDAYS_PER_PAGE, (holidayPage + 1) * HOLIDAYS_PER_PAGE);

            if (filtered.length === 0) {
              return <p className="text-sm text-[#94A3B8]">Keine Feiertage gefunden.</p>;
            }

            return (
              <>
                <div className="space-y-2">
                  {pageHolidays.map((h) => {
                    const isBlocked = blockedHolidays.includes(h.date);
                    return (
                      <div key={h.date} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#F8FAFC]">
                        <div>
                          <p className="text-sm font-medium text-[#1E293B]">{h.name}</p>
                          <p className="text-xs text-[#94A3B8]">{formatDate(h.date)}</p>
                        </div>
                        <button
                          onClick={() => toggleHoliday(h.date)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            isBlocked ? 'bg-[#0B8ECA]' : 'bg-[#E2E8F0]'
                          }`}
                          title={isBlocked ? 'Feiertag blockiert' : 'Feiertag nicht blockiert'}
                        >
                          <div
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              isBlocked ? 'translate-x-[22px]' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                    <button
                      onClick={() => setHolidayPage((p) => Math.max(0, p - 1))}
                      disabled={holidayPage === 0}
                      className="rounded-lg px-3 py-1 text-sm text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Zurück
                    </button>
                    <span className="text-xs text-[#94A3B8]">
                      Seite {holidayPage + 1} von {totalPages}
                    </span>
                    <button
                      onClick={() => setHolidayPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={holidayPage >= totalPages - 1}
                      className="rounded-lg px-3 py-1 text-sm text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Weiter →
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'schedules' | 'advanced';

export function AvailabilityPage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('schedules');

  // Derived state with defaults
  const schedule: WeeklySchedule = profile?.availability?.weeklySchedule ?? {
    monday: [{ ...DEFAULT_SLOT }],
    tuesday: [{ ...DEFAULT_SLOT }],
    wednesday: [{ ...DEFAULT_SLOT }],
    thursday: [{ ...DEFAULT_SLOT }],
    friday: [{ ...DEFAULT_SLOT }],
    saturday: [],
    sunday: [],
  };
  const timezone: string = profile?.timezone ?? 'Europe/Berlin';
  const maxPerDay: number | null = profile?.availability?.maxPerDay ?? null;
  const maxPerWeek: number | null = profile?.availability?.maxPerWeek ?? null;
  const blockedHolidays: string[] = profile?.availability?.blockedHolidays ?? [];
  const holidayCountry: string = profile?.availability?.holidayCountry ?? 'de';
  const dateSpecificHours: DateSpecificHours = profile?.availability?.dateSpecificHours ?? {};

  const load = async () => {
    setIsLoading(true);
    try {
      setProfile(await getMyProfile());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** Persist availability + timezone in one save action. */
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateMyAvailability({
        weeklySchedule: schedule,
        maxPerDay,
        maxPerWeek,
        blockedHolidays,
        holidayCountry,
        dateSpecificHours,
      });
      await updateMyTimezone(timezone);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Helper to patch nested availability state. */
  const patchAvailability = (patch: Record<string, unknown>) => {
    setProfile((prev: any) => ({
      ...prev,
      availability: { ...(prev?.availability ?? {}), ...patch },
    }));
  };

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <ErrorMessage message="Profil konnte nicht geladen werden" onRetry={load} />;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'schedules', label: 'Zeitplan' },
    { key: 'advanced', label: 'Erweiterte Einstellungen' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Verfügbarkeit</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          {isSaving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Tabs */}
      <div className="mt-6 flex border-b border-[#E2E8F0]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 pb-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA]'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'schedules' && (
          <SchedulesTab
            schedule={schedule}
            timezone={timezone}
            dateSpecificHours={dateSpecificHours}
            onScheduleChange={(s) => patchAvailability({ weeklySchedule: s })}
            onTimezoneChange={(tz) => setProfile((prev: any) => ({ ...prev, timezone: tz }))}
            onDateSpecificHoursChange={(dsh) => patchAvailability({ dateSpecificHours: dsh })}
          />
        )}

        {activeTab === 'advanced' && (
          <AdvancedSettingsTab
            maxPerDay={maxPerDay}
            maxPerWeek={maxPerWeek}
            holidayCountry={holidayCountry}
            blockedHolidays={blockedHolidays}
            onMaxPerDayChange={(v) => patchAvailability({ maxPerDay: v })}
            onMaxPerWeekChange={(v) => patchAvailability({ maxPerWeek: v })}
            onHolidayCountryChange={(c) => patchAvailability({ holidayCountry: c })}
            onBlockedHolidaysChange={(h) => patchAvailability({ blockedHolidays: h })}
          />
        )}
      </div>
    </div>
  );
}
