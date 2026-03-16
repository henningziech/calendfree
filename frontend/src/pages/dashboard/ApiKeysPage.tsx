import { useState, useEffect } from 'react';
import { Navigate } from 'react-router';
import { getMyApiKeys, createApiKey, deleteApiKey } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

/** Tab content for API Keys — no page-level heading, used inside AccountSettingsPage */
export function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setKeys(await getMyApiKeys());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createApiKey(newKeyName) as any;
      setCreatedKey(result.key);
      setNewKeyName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('API Key wirklich löschen?')) return;
    try {
      await deleteApiKey(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <p className="text-sm text-[#64748B]">Erstellen Sie API Keys für programmatischen Zugriff auf Ihre Termine.</p>

      {error && <ErrorMessage message={error} />}

      {createdKey && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">Neuer API Key erstellt! Kopieren Sie ihn jetzt — er wird nicht erneut angezeigt.</p>
          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-sm font-mono ring-1 ring-emerald-200">{createdKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(createdKey); }} className="mt-2 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline">
            Kopieren
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex gap-3">
        <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key-Name (z.B. 'n8n Integration')" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
        <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">Erstellen</button>
      </form>

      <div className="mt-6 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-[#F59E0B]" />
              <div>
                <h3 className="font-medium text-[#1E293B]">{k.name}</h3>
                <p className="text-sm text-[#64748B]">
                  {k.keyPrefix}... · Erstellt: {new Date(k.createdAt).toLocaleDateString('de-DE')}
                  {k.lastUsedAt && ` · Zuletzt: ${new Date(k.lastUsedAt).toLocaleDateString('de-DE')}`}
                </p>
              </div>
            </div>
            <button onClick={() => handleDelete(k.id)} className="text-sm font-medium text-[#EF4444] transition-colors hover:text-red-600">Löschen</button>
          </div>
        ))}
        {keys.length === 0 && <p className="text-[#64748B] text-sm">Keine API Keys vorhanden.</p>}
      </div>
    </div>
  );
}

/** Backwards compatibility redirect — old /dashboard/api-keys route now points to settings */
export function ApiKeysPage() {
  return <Navigate to="/dashboard/settings?tab=apikeys" replace />;
}
