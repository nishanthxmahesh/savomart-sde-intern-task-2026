import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-full px-4 py-10 bg-savo-mist">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Logo size="md" />
          <button onClick={logout} className="text-sm text-savo-purple font-semibold hover:underline">
            Log out
          </button>
        </div>
        <div className="savo-card p-6">
          <h1 className="text-xl font-bold text-savo-ink">
            Hi {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-savo-ink/60 mt-1">
            You're signed in. Full dashboard arrives in Phase 2.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-savo-purple text-savo-yellow font-semibold text-sm">
            {user?.points_balance ?? 0} pts · {user?.tier}
          </div>
        </div>
      </div>
    </div>
  );
}
