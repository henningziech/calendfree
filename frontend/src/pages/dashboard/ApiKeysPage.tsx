import { useState, useEffect } from 'react';
import { getMyApiKeys, createApiKey, deleteApiKey } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function ApiKeysPage() {
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
      <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
      <p className="mt-2 text-sm text-gray-600">Erstellen Sie API Keys für programmatischen Zugriff auf Ihre Termine.</p>

      {error && <ErrorMessage message={error} />}

      {createdKey && (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Neuer API Key erstellt! Kopieren Sie ihn jetzt — er wird nicht erneut angezeigt.</p>
          <code className="mt-2 block break-all rounded bg-white p-3 text-sm font-mono">{createdKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(createdKey); }} className="mt-2 text-sm text-green-700 hover:underline">
            Kopieren
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex gap-3">
        <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key-Name (z.B. 'n8n Integration')" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Erstellen</button>
      </form>

      <div className="mt-6 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium text-gray-900">{k.name}</h3>
              <p className="text-sm text-gray-500">
                {k.keyPrefix}... · Erstellt: {new Date(k.createdAt).toLocaleDateString('de-DE')}
                {k.lastUsedAt && ` · Zuletzt: ${new Date(k.lastUsedAt).toLocaleDateString('de-DE')}`}
              </p>
            </div>
            <button onClick={() => handleDelete(k.id)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
          </div>
        ))}
        {keys.length === 0 && <p className="text-gray-500 text-sm">Keine API Keys vorhanden.</p>}
      </div>
    </div>
  );
}
