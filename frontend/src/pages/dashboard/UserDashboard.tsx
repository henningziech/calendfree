import { useAuth } from '../../context/AuthContext';

export function UserDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Meine Termine</h1>
      <p className="mt-2 text-gray-600">Willkommen, {user?.name}.</p>
      <div className="mt-6 rounded-lg border bg-white p-8 text-center text-gray-500">
        Ihre kommenden und vergangenen Termine erscheinen hier.
      </div>
    </div>
  );
}
