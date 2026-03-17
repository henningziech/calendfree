import { useState, useEffect } from 'react';
import { Link } from 'react-router';
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
        <h1 className="text-2xl font-bold text-[#1E293B]">Companies</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          + Neue Company
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="slug" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0874A6]">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {companies.map((c) => (
          <Link key={c.id} to={`/admin/companies/${c.id}`} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-[#0B8ECA]" />
              <div>
                <h3 className="font-medium text-[#1E293B]">{c.name}</h3>
                <p className="text-sm text-[#64748B]">/{c.slug}</p>
              </div>
            </div>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(c.id, c.name); }} className="text-sm font-medium text-[#EF4444] transition-colors hover:text-red-600">Löschen</button>
          </Link>
        ))}
        {companies.length === 0 && <p className="text-[#64748B] text-sm">Keine Companies vorhanden.</p>}
      </div>
    </div>
  );
}
