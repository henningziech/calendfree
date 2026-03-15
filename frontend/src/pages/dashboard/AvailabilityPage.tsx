import { useState, useEffect } from 'react';
import { getMyProfile, updateMyAvailability, updateMyTimezone } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
];

export function AvailabilityPage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!profile?.availability) return;
    setIsSaving(true);
    try {
      await updateMyAvailability({
        weeklySchedule: profile.availability.weeklySchedule,
        maxPerDay: profile.availability.maxPerDay,
        maxPerWeek: profile.availability.maxPerWeek,
      });
      await updateMyTimezone(profile.timezone);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <ErrorMessage message="Profil konnte nicht geladen werden" onRetry={load} />;

  const schedule = profile.availability?.weeklySchedule ?? {};

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Verfügbarkeit</h1>
        <button onClick={handleSave} disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {isSaving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">Timezone</label>
          <select
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
            className="mt-1 rounded-md border px-3 py-2 text-sm"
          >
            {['Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-medium text-gray-900">Arbeitszeiten</h3>
          <div className="mt-3 space-y-2">
            {DAYS.map((day) => {
              const slots = schedule[day.key] ?? [];
              const hasSlot = slots.length > 0;
              const start = hasSlot ? slots[0].start : '09:00';
              const end = hasSlot ? slots[0].end : '17:00';

              return (
                <div key={day.key} className="flex items-center gap-3">
                  <label className="w-28 text-sm text-gray-700">{day.label}</label>
                  <input
                    type="checkbox"
                    checked={hasSlot}
                    onChange={(e) => {
                      const newSchedule = { ...schedule };
                      newSchedule[day.key] = e.target.checked ? [{ start: '09:00', end: '17:00' }] : [];
                      setProfile({
                        ...profile,
                        availability: { ...profile.availability, weeklySchedule: newSchedule },
                      });
                    }}
                  />
                  {hasSlot && (
                    <>
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => {
                          const newSchedule = { ...schedule };
                          newSchedule[day.key] = [{ start: e.target.value, end }];
                          setProfile({ ...profile, availability: { ...profile.availability, weeklySchedule: newSchedule } });
                        }}
                        className="rounded-md border px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => {
                          const newSchedule = { ...schedule };
                          newSchedule[day.key] = [{ start, end: e.target.value }];
                          setProfile({ ...profile, availability: { ...profile.availability, weeklySchedule: newSchedule } });
                        }}
                        className="rounded-md border px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-medium text-gray-900">Limits</h3>
          <div className="mt-3 flex gap-6">
            <div>
              <label className="block text-sm text-gray-600">Max. pro Tag</label>
              <input
                type="number"
                value={profile.availability?.maxPerDay ?? 8}
                onChange={(e) => setProfile({ ...profile, availability: { ...profile.availability, maxPerDay: +e.target.value || null } })}
                min={1} max={50}
                className="mt-1 w-20 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Max. pro Woche</label>
              <input
                type="number"
                value={profile.availability?.maxPerWeek ?? 30}
                onChange={(e) => setProfile({ ...profile, availability: { ...profile.availability, maxPerWeek: +e.target.value || null } })}
                min={1} max={200}
                className="mt-1 w-20 rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
