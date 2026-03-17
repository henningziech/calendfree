import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMyProfile, updateMyAvailability, updateMyTimezone, getHolidays } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { formatDateLocalized } from '../../utils/dateLocale';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

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

const HOLIDAY_COUNTRY_CODES = ['de', 'at', 'ch', 'gb', 'us'] as const;

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
  const { t } = useTranslation('dashboard');
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
    const allKeys = DAY_KEYS.filter((d) => d !== sourceDayKey);
    setSelected(new Set(allKeys));
  };

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-[#64748B]">{t('availability.copyTimesTo')}</p>
      <button onClick={selectAll} className="mb-2 text-xs text-[#0B8ECA] hover:underline">
        {t('availability.selectAll')}
      </button>
      {DAY_KEYS.filter((d) => d !== sourceDayKey).map((d) => (
        <label key={d} className="flex items-center gap-2 py-0.5 text-sm text-[#1E293B]">
          <input
            type="checkbox"
            checked={selected.has(d)}
            onChange={() => toggle(d)}
            className="accent-[#0B8ECA]"
          />
          {t(`availability.days.${d}`)}
        </label>
      ))}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => { onApply(Array.from(selected)); onClose(); }}
          disabled={selected.size === 0}
          className="rounded-lg bg-[#0B8ECA] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {t('availability.apply')}
        </button>
        <button onClick={onClose} className="rounded-lg px-3 py-1 text-xs text-[#64748B] hover:bg-[#F1F5F9]">
          {t('common:cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── Schedules Tab ─────────────────────────────────────────────────────────────

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
  const { t } = useTranslation(['dashboard', 'common']);
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
          {t('dashboard:availability.workingHours')}
        </h3>

        <div className="mt-4 space-y-3">
          {DAY_KEYS.map((day) => {
            const slots = schedule[day] ?? [];
            const isAvailable = slots.length > 0;

            return (
              <div key={day} className="relative">
                <div className="flex items-start gap-3">
                  {/* Day circle */}
                  <button
                    onClick={() => toggleDay(day)}
                    title={t(`dashboard:availability.days.${day}`)}
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white transition-colors ${
                      isAvailable ? 'bg-[#0B8ECA]' : 'bg-[#64748B]'
                    }`}
                  >
                    {t(`dashboard:availability.dayShort.${day}`)}
                  </button>

                  {/* Slots or "Nicht verfügbar" */}
                  <div className="flex-1">
                    {!isAvailable ? (
                      <p className="mt-1.5 text-sm text-[#94A3B8]">{t('dashboard:availability.unavailable')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(day, idx, 'start', e.target.value)}
                              className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                            />
                            <span className="text-[#64748B]">–</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(day, idx, 'end', e.target.value)}
                              className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                            />
                            {/* Remove slot */}
                            <button
                              onClick={() => removeSlot(day, idx)}
                              className="text-[#94A3B8] hover:text-red-500"
                              title={t('dashboard:availability.removeSlot')}
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
                            onClick={() => addSlot(day)}
                            className="text-xs text-[#0B8ECA] hover:underline"
                            title={t('dashboard:availability.addTimeSlot')}
                          >
                            {t('dashboard:availability.addTimeSlot')}
                          </button>
                          <button
                            onClick={() => setCopyDay(copyDay === day ? null : day)}
                            className="text-[#94A3B8] hover:text-[#0B8ECA]"
                            title={t('dashboard:availability.copyTimes')}
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
                {copyDay === day && (
                  <CopyPopover
                    sourceDayKey={day}
                    schedule={schedule}
                    onApply={(targets) => copyToTargets(day, targets)}
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
              {t('dashboard:availability.dateSpecificHours')}
            </h3>
            <p className="mt-1 text-xs text-[#94A3B8]">{t('dashboard:availability.dateSpecificHoursHint')}</p>
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
              {t('dashboard:availability.addHours')}
            </button>
          )}
        </div>

        {/* Inline add form */}
        {dshFormOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div>
              <label className="block text-xs font-medium text-[#1E293B]">{t('dashboard:availability.date')}</label>
              <input
                type="date"
                value={dshDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDshDate(e.target.value)}
                className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B]">{t('dashboard:availability.timeSlots')}</label>
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
                        title={t('dashboard:availability.removeSlot')}
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
                  {t('dashboard:availability.addTimeSlot')}
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
                {t('common:add')}
              </button>
              <button
                onClick={() => setDshFormOpen(false)}
                className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B]"
              >
                {t('common:cancel')}
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
                    <p className="text-sm font-medium text-[#1E293B]">{formatDateLocalized(date)}</p>
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
                    title={t('dashboard:availability.deleteEntry')}
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
        <label className="block text-sm font-medium text-[#1E293B]">{t('dashboard:availability.timezone')}</label>
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
  const { t } = useTranslation('dashboard');
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
      .catch((err) => { if (!cancelled) setHolidaysError(err.message ?? 'Error'); })
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
      return formatDateLocalized(iso);
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Appointment limits */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
          {t('availability.appointmentLimits')}
        </h3>
        <div className="mt-4 flex gap-8">
          <div>
            <label className="block text-sm text-[#1E293B]">{t('availability.maxPerDay')}</label>
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
            <label className="block text-sm text-[#1E293B]">{t('availability.maxPerWeek')}</label>
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
          {t('availability.holidays')}
        </h3>

        {/* Country selector */}
        <div className="mt-3">
          <label className="block text-sm text-[#1E293B]">{t('availability.country')}</label>
          <select
            value={holidayCountry}
            onChange={(e) => onHolidayCountryChange(e.target.value)}
            className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            {HOLIDAY_COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>{t(`availability.countries.${code}`)}</option>
            ))}
          </select>
        </div>

        {/* Info banner */}
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#0B8ECA]/5 px-3 py-2">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#0B8ECA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-xs text-[#0B8ECA]">
            {t('availability.holidayInfo')}
          </p>
        </div>

        {/* Hide past toggle */}
        <div className="mt-3 flex items-center justify-between">
          <label className="text-sm text-[#64748B]">{t('availability.hidePastHolidays')}</label>
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
            <p className="text-sm text-[#94A3B8]">{t('availability.loadingHolidays')}</p>
          )}

          {holidaysError && (
            <p className="text-sm text-red-500">{t('availability.holidayError', { message: holidaysError })}</p>
          )}

          {!holidaysLoading && !holidaysError && (() => {
            const today = new Date().toISOString().split('T')[0];
            const filtered = hidePast ? holidays.filter((h) => h.date >= today) : holidays;
            const totalPages = Math.ceil(filtered.length / HOLIDAYS_PER_PAGE);
            const pageHolidays = filtered.slice(holidayPage * HOLIDAYS_PER_PAGE, (holidayPage + 1) * HOLIDAYS_PER_PAGE);

            if (filtered.length === 0) {
              return <p className="text-sm text-[#94A3B8]">{t('availability.noHolidays')}</p>;
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
                          title={isBlocked ? t('availability.holidayBlocked') : t('availability.holidayNotBlocked')}
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
                      {t('availability.previousPage')}
                    </button>
                    <span className="text-xs text-[#94A3B8]">
                      {t('availability.pageOf', { page: holidayPage + 1, total: totalPages })}
                    </span>
                    <button
                      onClick={() => setHolidayPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={holidayPage >= totalPages - 1}
                      className="rounded-lg px-3 py-1 text-sm text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {t('availability.nextPage')}
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
  const { t } = useTranslation(['dashboard', 'common']);
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
  if (!profile) return <ErrorMessage message={t('dashboard:availability.profileError')} onRetry={load} />;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'schedules', label: t('dashboard:availability.tabSchedules') },
    { key: 'advanced', label: t('dashboard:availability.tabAdvanced') },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">{t('dashboard:availability.title')}</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          {isSaving ? t('dashboard:availability.saving') : t('common:save')}
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
