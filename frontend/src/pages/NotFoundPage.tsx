import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-white to-[#F8FAFC]">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <img src="/logo-mini.png" alt="Calendfree" className="h-14 w-14 rounded-2xl opacity-50" />
        </div>
        <h1 className="text-6xl font-extrabold text-[#E2E8F0]">404</h1>
        <p className="mt-4 text-lg font-medium text-[#1E293B]">Seite nicht gefunden</p>
        <p className="mt-2 text-sm text-[#64748B]">
          Die Buchungsseite existiert nicht oder wurde entfernt.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-[#0B8ECA] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}
