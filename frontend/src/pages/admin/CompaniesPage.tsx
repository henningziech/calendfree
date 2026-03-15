import { useState, useEffect } from 'react';
import { getCompanies, createCompany, deleteCompany } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data);
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
      await createCompany({ name: newName, slug: newSlug });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Company "${name}" wirklich löschen?`)) return;
    try {
      await deleteCompany(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neue Company
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="slug" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {companies.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium text-gray-900">{c.name}</h3>
              <p className="text-sm text-gray-500">/{c.slug}</p>
            </div>
            <button onClick={() => handleDelete(c.id, c.name)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
          </div>
        ))}
        {companies.length === 0 && <p className="text-gray-500 text-sm">Keine Companies vorhanden.</p>}
      </div>
    </div>
  );
}
