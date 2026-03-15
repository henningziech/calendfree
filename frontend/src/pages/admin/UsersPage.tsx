import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCompanyUsers, inviteUser, removeUser } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'USER' });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      setUsers(await getCompanyUsers(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await inviteUser(companyId, form);
      setShowInvite(false);
      setForm({ email: '', name: '', role: 'USER' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Users</h1>
        <button onClick={() => setShowInvite(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          + User einladen
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showInvite && (
        <form onSubmit={handleInvite} className="mt-4 flex gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-Mail" type="email" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
            <option value="USER">User</option>
            <option value="COMPANY_ADMIN">Company Admin</option>
            <option value="ORG_ADMIN">Org Admin</option>
          </select>
          <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0874A6]">Einladen</button>
          <button type="button" onClick={() => setShowInvite(false)} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
              {u.avatarUrl && <img src={u.avatarUrl} className="h-8 w-8 rounded-full ring-2 ring-[#E2E8F0]" alt="" />}
              <div>
                <h3 className="font-medium text-[#1E293B]">{u.name}</h3>
                <p className="text-sm text-[#64748B]">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#0B8ECA]/10 px-3 py-1 text-xs font-medium text-[#0B8ECA]">{u.role}</span>
              <span className={`h-2 w-2 rounded-full ${u.googleConnected ? 'bg-[#10B981]' : 'bg-[#E2E8F0]'}`} title={u.googleConnected ? 'Google verbunden' : 'Nicht verbunden'} />
              <button onClick={() => { if (confirm(`${u.name} entfernen?`)) removeUser(companyId!, u.id).then(load); }} className="text-sm font-medium text-[#EF4444] transition-colors hover:text-red-600">Entfernen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
