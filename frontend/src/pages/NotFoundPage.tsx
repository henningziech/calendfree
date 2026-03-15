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
