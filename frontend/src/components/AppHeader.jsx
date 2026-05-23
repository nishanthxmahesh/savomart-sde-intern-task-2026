import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';

function initialsOf(name) {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
}

export default function AppHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-savo-purple-100/60">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <button
            className="relative w-9 h-9 rounded-full grid place-items-center text-savo-purple hover:bg-savo-purple-50 transition"
            aria-label="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-savo-yellow border border-white" />
          </button>
          <button
            onClick={logout}
            className="hidden sm:inline-flex text-xs font-semibold text-savo-purple hover:underline"
          >
            Log out
          </button>
          <div
            className="w-9 h-9 rounded-full bg-savo-purple text-savo-yellow grid place-items-center font-bold text-sm"
            title={user?.name}
          >
            {initialsOf(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
