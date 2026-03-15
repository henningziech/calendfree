import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function RoutingFormsPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '' });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      setForms(await apiRequest(`/admin/companies/${companyId}/routing-forms`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await apiRequest(`/admin/companies/${companyId}/routing-forms`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ title: '', slug: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Routing Form wirklich löschen?')) return;
    try {
      await apiRequest(`/admin/routing-forms/${id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Routing Forms</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neues Routing Form
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500">Leiten Sie Besucher basierend auf ihren Antworten zum passenden Event Type.</p>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel (z.B. Themenwahl)" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug (z.B. start)" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {forms.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500">/{f.slug} · {f.rules?.length ?? 0} Regeln · {f.active ? 'Aktiv' : 'Inaktiv'}</p>
            </div>
            <button onClick={() => handleDelete(f.id)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
          </div>
        ))}
        {forms.length === 0 && <p className="text-gray-500 text-sm">Keine Routing Forms vorhanden.</p>}
      </div>
    </div>
  );
}
