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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: 'Buchungen (30 Tage)', value: data.summary.total30d },
          { label: 'Buchungen (7 Tage)', value: data.summary.totalWeek },
          { label: 'Stornierungen', value: data.summary.cancelled30d },
          { label: 'Storno-Rate', value: `${data.summary.cancelRate}%` },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-medium text-gray-900">Buchungen pro Tag (30 Tage)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top users */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-medium text-gray-900">Top Consultants (30 Tage)</h3>
        <div className="space-y-2">
          {data.byUser.map((u, i) => (
            <div key={u.name} className="flex items-center gap-3">
              <span className="w-6 text-sm text-gray-400">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-sm text-gray-500">{u.count} Buchungen</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${(u.count / (data.byUser[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {data.byUser.length === 0 && <p className="text-sm text-gray-500">Noch keine Buchungsdaten.</p>}
        </div>
      </div>
    </div>
  );
}
