import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminProtectedRoute({ children, requireSuperadmin = false }) {
  const { isAuthenticated, isSuperadmin } = useAdminAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  if (requireSuperadmin && !isSuperadmin) {
    return (
      <div className="min-h-full grid place-items-center bg-savo-mist">
        <div className="savo-card p-8 text-center max-w-md">
          <p className="text-4xl mb-2">🔒</p>
          <h1 className="font-bold text-savo-ink">Superadmin only</h1>
          <p className="text-sm text-savo-ink/60 mt-1">
            This area is reserved for accounts with the superadmin role.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
