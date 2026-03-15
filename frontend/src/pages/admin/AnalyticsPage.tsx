// frontend/src/pages/admin/AnalyticsPage.tsx
import { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AnalyticsData {
  summary: { total30d: number; totalWeek: number; cancelled30d: number; cancelRate: number };
  byStatus: Array<{ status: string; count: number }>;
  byUser: Array<{ name: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setData(await apiRequest('/admin/analytics/overview'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!data) return null;

  const summaryCards = [
    { label: 'Buchungen (30 Tage)', value: data.summary.total30d, accent: '#0B8ECA' },
    { label: 'Buchungen (7 Tage)', value: data.summary.totalWeek, accent: '#14B8A6' },
    { label: 'Stornierungen', value: data.summary.cancelled30d, accent: '#EF4444' },
    { label: 'Storno-Rate', value: `${data.summary.cancelRate}%`, accent: '#F59E0B' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Analytics</h1>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="mb-2 h-1 w-8 rounded-full" style={{ backgroundColor: card.accent }} />
            <p className="text-sm text-[#64748B]">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#1E293B]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-[#1E293B]">Buchungen pro Tag (30 Tage)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748B' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0B8ECA" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top users */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-[#1E293B]">Top Consultants (30 Tage)</h3>
        <div className="space-y-3">
          {data.byUser.map((u, i) => (
            <div key={u.name} className="flex items-center gap-3">
              <span className="w-6 text-sm font-medium text-[#64748B]">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#1E293B]">{u.name}</span>
                  <span className="text-sm text-[#64748B]">{u.count} Buchungen</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[#F8FAFC]">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6]"
                    style={{ width: `${(u.count / (data.byUser[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {data.byUser.length === 0 && <p className="text-sm text-[#64748B]">Noch keine Buchungsdaten.</p>}
        </div>
      </div>
    </div>
  );
}
