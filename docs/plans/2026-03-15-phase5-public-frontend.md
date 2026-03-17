# Calendfree Phase 5: Public Frontend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing booking experience: slot picker calendar, booking form, confirmation page, and cancel/reschedule pages. These pages are unauthenticated and accessible to external customers.

**Architecture:** React Router for routing, API client layer for backend communication, reusable calendar/form components. Pages load their own data. Branding is fetched from the API and applied via CSS custom properties.

**Tech Stack:** React 19, React Router v7, Tailwind CSS, date-fns

---

## Chunk 1: Router, API Client, Shared Components

### Task 1: Install Dependencies & Set Up Router

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Install react-router and date-fns**

```bash
cd /Users/hziech/calendfree && npm install -w frontend react-router date-fns
```

- [ ] **Step 2: Set up React Router in App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import { BookingPage } from './pages/booking/BookingPage';
import { ConfirmationPage } from './pages/booking/ConfirmationPage';
import { CancelPage } from './pages/manage/CancelPage';
import { ReschedulePage } from './pages/manage/ReschedulePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:companySlug/:eventTypeSlug" element={<BookingPage />} />
        <Route path="/:companySlug/:eventTypeSlug/confirmed" element={<ConfirmationPage />} />
        <Route path="/manage/:token/cancel" element={<CancelPage />} />
        <Route path="/manage/:token/reschedule" element={<ReschedulePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Commit + push**

```bash
cd /Users/hziech/calendfree && git add frontend/ && git commit -m "feat: add React Router with public booking routes" && git push
```

---

### Task 2: Create API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/booking.ts`
- Create: `frontend/src/api/branding.ts`

- [ ] **Step 1: Create base API client**

```typescript
// frontend/src/api/client.ts
const BASE_URL = '/api';

/** Generic fetch wrapper with error handling. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 2: Create booking API**

```typescript
// frontend/src/api/booking.ts
import { apiRequest } from './client';

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingResponse {
  id: string;
  startTime: string;
  endTime: string;
  assignedUser: { name: string; email: string };
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
}

/** Fetch available time slots for an event type. */
export async function getSlots(
  companySlug: string,
  eventTypeSlug: string,
  date?: string,
  timezone?: string,
): Promise<{ slots: TimeSlot[] }> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (timezone) params.set('timezone', timezone);
  const qs = params.toString();
  return apiRequest(`/booking/${companySlug}/${eventTypeSlug}/slots${qs ? `?${qs}` : ''}`);
}

/** Create a booking. */
export async function createBooking(
  companySlug: string,
  eventTypeSlug: string,
  data: {
    startTime: string;
    timezone: string;
    name: string;
    email: string;
    formData?: Record<string, string>;
  },
): Promise<BookingResponse> {
  return apiRequest(`/booking/${companySlug}/${eventTypeSlug}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Cancel a booking via token. */
export async function cancelBooking(token: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/booking/${token}/cancel`, { method: 'POST' });
}
```

- [ ] **Step 3: Create branding API**

```typescript
// frontend/src/api/branding.ts
import { apiRequest } from './client';

export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  fontFamily: string;
}

export interface CompanyInfo {
  name: string;
  slug: string;
  branding: BrandingConfig | null;
}

/** Fetch company info and branding for a public booking page. */
export async function getCompanyBranding(companySlug: string): Promise<CompanyInfo> {
  return apiRequest(`/booking/${companySlug}/info`);
}
```

- [ ] **Step 4: Commit + push**

```bash
cd /Users/hziech/calendfree && git add frontend/src/api/ && git commit -m "feat: add API client with booking and branding endpoints" && git push
```

---

### Task 3: Create Shared UI Components

**Files:**
- Create: `frontend/src/components/calendar/SlotPicker.tsx`
- Create: `frontend/src/components/forms/BookingForm.tsx`
- Create: `frontend/src/components/layout/BrandedLayout.tsx`
- Create: `frontend/src/components/ui/LoadingSpinner.tsx`
- Create: `frontend/src/components/ui/ErrorMessage.tsx`

- [ ] **Step 1: Create LoadingSpinner and ErrorMessage**

```tsx
// frontend/src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner({ text = 'Laden...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <p className="mt-3 text-sm text-gray-500">{text}</p>
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/ErrorMessage.tsx
export function ErrorMessage({
  title = 'Fehler',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <h3 className="text-lg font-semibold text-red-800">{title}</h3>
      <p className="mt-2 text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create BrandedLayout**

```tsx
// frontend/src/components/layout/BrandedLayout.tsx
import { type ReactNode, useEffect } from 'react';
import type { BrandingConfig } from '../../api/branding';

export function BrandedLayout({
  children,
  branding,
  companyName,
}: {
  children: ReactNode;
  branding?: BrandingConfig | null;
  companyName?: string;
}) {
  useEffect(() => {
    if (branding) {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', branding.primaryColor || '#2563EB');
      root.style.setProperty('--color-accent', branding.accentColor || '#7C3AED');
    }
  }, [branding]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {branding?.logoUrl && (
          <div className="mb-6 flex justify-center">
            <img src={branding.logoUrl} alt={companyName} className="h-10" />
          </div>
        )}
        {children}
        <footer className="mt-12 text-center text-xs text-gray-400">
          {companyName && <span>{companyName} — </span>}
          Powered by Calendfree
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create SlotPicker**

```tsx
// frontend/src/components/calendar/SlotPicker.tsx
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

export function SlotPicker({ slots, selectedSlot, onSelectSlot, timezone }: SlotPickerProps) {
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
```

- [ ] **Step 4: Create BookingForm**

```tsx
// frontend/src/components/forms/BookingForm.tsx
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-800">{eventTypeTitle}</p>
        <p className="text-sm text-blue-600">{selectedTime}</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Max Mustermann"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          E-Mail *
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="max@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Wird gebucht...' : 'Termin buchen'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Commit + push**

```bash
cd /Users/hziech/calendfree && git add frontend/src/components/ && git commit -m "feat: add shared UI components (SlotPicker, BookingForm, BrandedLayout, LoadingSpinner, ErrorMessage)" && git push
```

---

## Chunk 2: Booking & Management Pages

### Task 4: Create Public Pages

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/NotFoundPage.tsx`
- Create: `frontend/src/pages/booking/BookingPage.tsx`
- Create: `frontend/src/pages/booking/ConfirmationPage.tsx`
- Create: `frontend/src/pages/manage/CancelPage.tsx`
- Create: `frontend/src/pages/manage/ReschedulePage.tsx`

- [ ] **Step 1: Create HomePage and NotFoundPage**

```tsx
// frontend/src/pages/HomePage.tsx
export function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Calendfree</h1>
        <p className="mt-2 text-lg text-gray-600">Round-Robin Scheduling Platform</p>
      </div>
    </div>
  );
}
```

```tsx
// frontend/src/pages/NotFoundPage.tsx
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-lg text-gray-600">Seite nicht gefunden</p>
        <p className="mt-2 text-sm text-gray-400">
          Die Buchungsseite existiert nicht oder wurde entfernt.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create BookingPage (main booking flow)**

```tsx
// frontend/src/pages/booking/BookingPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getSlots, createBooking, type TimeSlot } from '../../api/booking';
import { SlotPicker } from '../../components/calendar/SlotPicker';
import { BookingForm } from '../../components/forms/BookingForm';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function BookingPage() {
  const { companySlug, eventTypeSlug } = useParams<{ companySlug: string; eventTypeSlug: string }>();
  const navigate = useNavigate();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadSlots = useCallback(async () => {
    if (!companySlug || !eventTypeSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSlots(companySlug, eventTypeSlug, undefined, timezone);
      setSlots(data.slots);
    } catch (err: any) {
      if (err.status === 404) {
        setError('Buchungsseite nicht gefunden.');
      } else {
        setError('Termine konnten nicht geladen werden.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companySlug, eventTypeSlug, timezone]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleBooking = async (formData: { name: string; email: string }) => {
    if (!selectedSlot || !companySlug || !eventTypeSlug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking(companySlug, eventTypeSlug, {
        startTime: selectedSlot.start,
        timezone,
        ...formData,
      });
      navigate(`/${companySlug}/${eventTypeSlug}/confirmed`, {
        state: { booking },
      });
    } catch (err: any) {
      if (err.status === 409) {
        setError('Dieser Slot ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen.');
        setSelectedSlot(null);
        loadSlots();
      } else {
        setError('Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BrandedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{eventTypeSlug?.replace(/-/g, ' ')}</h1>
          <p className="mt-1 text-sm text-gray-500">Wählen Sie einen passenden Termin</p>
        </div>

        {error && <ErrorMessage message={error} onRetry={error.includes('geladen') ? loadSlots : undefined} />}

        {isLoading ? (
          <LoadingSpinner text="Verfügbare Termine werden geladen..." />
        ) : !selectedSlot ? (
          <SlotPicker
            slots={slots}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            timezone={timezone}
          />
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedSlot(null)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Anderen Termin wählen
            </button>
            <BookingForm
              onSubmit={handleBooking}
              isSubmitting={isSubmitting}
              eventTypeTitle={eventTypeSlug?.replace(/-/g, ' ') ?? ''}
              selectedTime={format(parseISO(selectedSlot.start), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            />
          </div>
        )}
      </div>
    </BrandedLayout>
  );
}
```

- [ ] **Step 3: Create ConfirmationPage**

```tsx
// frontend/src/pages/booking/ConfirmationPage.tsx
import { useLocation, Link } from 'react-router';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import type { BookingResponse } from '../../api/booking';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function ConfirmationPage() {
  const location = useLocation();
  const booking = location.state?.booking as BookingResponse | undefined;

  if (!booking) {
    return (
      <BrandedLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Keine Buchungsdaten gefunden.</p>
          <Link to="/" className="mt-4 text-blue-600 hover:underline">Zurück zur Startseite</Link>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termin bestätigt!</h1>
          <p className="mt-2 text-gray-600">Sie erhalten in Kürze eine Bestätigungsmail.</p>
        </div>

        <div className="rounded-lg bg-gray-50 p-6 text-left">
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Wann</dt>
              <dd className="font-medium">
                {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Mit</dt>
              <dd className="font-medium">{booking.assignedUser.name}</dd>
            </div>
            {booking.meetLink && (
              <div>
                <dt className="text-sm text-gray-500">Meeting-Link</dt>
                <dd>
                  <a href={booking.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Google Meet beitreten
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <a href={booking.rescheduleUrl} className="text-blue-600 hover:underline">Termin verschieben</a>
          <span className="text-gray-300">|</span>
          <a href={booking.cancelUrl} className="text-red-600 hover:underline">Termin absagen</a>
        </div>
      </div>
    </BrandedLayout>
  );
}
```

- [ ] **Step 4: Create CancelPage**

```tsx
// frontend/src/pages/manage/CancelPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router';
import { cancelBooking } from '../../api/booking';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm');
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      await cancelBooking(token);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Stornierung fehlgeschlagen.');
      setStatus('error');
    }
  };

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        {status === 'confirm' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Termin absagen?</h1>
            <p className="text-gray-600">Möchten Sie diesen Termin wirklich absagen?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleCancel}
                className="rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Ja, absagen
              </button>
              <button
                onClick={() => window.history.back()}
                className="rounded-md bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Abbrechen
              </button>
            </div>
          </>
        )}

        {status === 'loading' && <p className="text-gray-500">Wird storniert...</p>}

        {status === 'done' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Termin abgesagt</h1>
            <p className="text-gray-600">Ihr Termin wurde erfolgreich storniert.</p>
          </>
        )}

        {status === 'error' && <ErrorMessage message={error} onRetry={handleCancel} />}
      </div>
    </BrandedLayout>
  );
}
```

- [ ] **Step 5: Create ReschedulePage (placeholder)**

```tsx
// frontend/src/pages/manage/ReschedulePage.tsx
import { useParams } from 'react-router';
import { BrandedLayout } from '../../components/layout/BrandedLayout';

export function ReschedulePage() {
  const { token } = useParams<{ token: string }>();

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Termin verschieben</h1>
        <p className="text-gray-600">
          Wählen Sie einen neuen Termin. Ihr bestehender Termin wird automatisch storniert.
        </p>
        <p className="text-sm text-gray-400">
          Diese Funktion wird in einem zukünftigen Update verfügbar sein.
        </p>
      </div>
    </BrandedLayout>
  );
}
```

- [ ] **Step 6: Verify frontend builds**

```bash
cd /Users/hziech/calendfree && npm run build -w frontend
```

- [ ] **Step 7: Commit + push**

```bash
cd /Users/hziech/calendfree && git add frontend/src/pages/ && git commit -m "feat: add public booking pages (slot picker, booking form, confirmation, cancel, reschedule)" && git push
```

---

### Task 5: Add Company Info Endpoint to Backend

The frontend needs a public endpoint to fetch company info and event type details for the booking page.

**Files:**
- Modify: `backend/src/routes/booking.ts`
- Create: `backend/src/__tests__/booking-info.test.ts`

- [ ] **Step 1: Add company info and event type info endpoints**

Add to `backend/src/routes/booking.ts`:

```typescript
  /** GET /api/booking/:companySlug/info — Public company info (branding) */
  app.get('/api/booking/:companySlug/info', async (request, reply) => {
    const { companySlug } = request.params as { companySlug: string };
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
      include: {
        branding: true,
        organization: { include: { branding: true } },
      },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    // Use company branding, fall back to org branding
    const branding = company.branding ?? company.organization.branding;

    return {
      name: company.name,
      slug: company.slug,
      branding: branding ? {
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        logoUrl: branding.logoUrl,
        fontFamily: branding.fontFamily,
      } : null,
    };
  });

  /** GET /api/booking/:companySlug/:eventTypeSlug/info — Public event type info */
  app.get('/api/booking/:companySlug/:eventTypeSlug/info', async (request, reply) => {
    const { companySlug, eventTypeSlug } = request.params as { companySlug: string; eventTypeSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const eventType = await prisma.eventType.findFirst({
      where: { companyId: company.id, slug: eventTypeSlug, active: true },
      include: {
        formFields: { orderBy: { order: 'asc' } },
        team: { select: { name: true } },
      },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    return {
      title: eventType.title,
      slug: eventType.slug,
      description: eventType.description,
      duration: eventType.duration,
      color: eventType.color,
      teamName: eventType.team?.name ?? null,
      formFields: eventType.formFields,
    };
  });
```

- [ ] **Step 2: Write test**

```typescript
// backend/src/__tests__/booking-info.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Booking info endpoints', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/booking/:company/info returns company data for seeded company', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/booking/seibert-group-gmbh/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Seibert Group GmbH');
    expect(body.slug).toBe('seibert-group-gmbh');
  });

  it('GET /api/booking/:company/info returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/booking/nonexistent/info' });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Run tests, commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/ && git commit -m "feat: add public company and event type info endpoints" && git push
```

---

## Verification Checklist

1. **`npm run build -w frontend`** — frontend builds without errors
2. **`npm run test -w backend`** — all backend tests pass
3. **React Router** — routes configured for /, /:company/:event, /manage/:token/cancel, /manage/:token/reschedule
4. **API Client** — getSlots, createBooking, cancelBooking, getCompanyBranding
5. **SlotPicker** — shows dates with available slots, time grid for selected date
6. **BookingForm** — collects name + email, shows selected time, submit button
7. **BookingPage** — loads slots, shows picker, handles 409 (slot taken), navigates to confirmation
8. **ConfirmationPage** — shows booking details, meet link, cancel/reschedule links
9. **CancelPage** — confirm dialog, calls cancel API, shows success/error
10. **BrandedLayout** — applies CSS custom properties from branding config
11. **Company info endpoint** — returns branding with org fallback
