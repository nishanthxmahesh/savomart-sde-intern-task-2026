import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { adminLogin, adminErrorMessage } from '../api/admin';
import { useAdminAuth } from '../hooks/useAdminAuth';

function DemoCredentialRow({ label, email, password, accent, onFill }) {
  const badgeClass = accent === 'purple'
    ? 'bg-savo-yellow-soft text-amber-900'
    : 'bg-sky-100 text-sky-800';
  return (
    <button
      type="button"
      onClick={() => onFill(email, password)}
      className="w-full text-left rounded-xl border border-savo-purple-100 bg-white hover:bg-savo-purple-50 active:bg-savo-purple-50 transition px-3 py-2.5 group"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badgeClass}`}>
          {label}
        </span>
        <span className="text-[10px] text-savo-ink/45 font-semibold group-hover:text-savo-purple">
          Tap to fill →
        </span>
      </div>
      <p className="font-mono text-xs text-savo-ink truncate">{email}</p>
      <p className="font-mono text-xs text-savo-ink/60">password: <span className="text-savo-ink">{password}</span></p>
    </button>
  );
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const target = location.state?.from?.pathname?.startsWith('/admin') ? location.state.from.pathname : '/admin';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await adminLogin(email.trim().toLowerCase(), password);
      login(res.access_token, res.admin);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-savo-ink/95 via-savo-purple-dark to-savo-purple text-white">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-savo-yellow text-savo-purple grid place-items-center font-extrabold text-2xl shadow-savo-glow">
              S
            </div>
            <span className="font-extrabold text-2xl text-white tracking-tight">
              SAVO<span className="text-savo-yellow/80">admin</span>
            </span>
          </div>
          <p className="mt-3 text-white/70 text-sm">Ops console for the loyalty team.</p>
        </div>

        <form onSubmit={submit} className="bg-white text-savo-ink rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold">Sign in</h1>
            <p className="text-sm text-savo-ink/60 mt-0.5">
              Use your Savomart admin account.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/55 mb-1.5">
              Work email
            </label>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@savomart.in"
              className="savo-input"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/55 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="savo-input pr-16"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-savo-purple px-2 py-1 hover:bg-savo-purple-50 rounded"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password} className="savo-btn-primary w-full">
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
            ) : (
              'Sign in'
            )}
          </button>

          <div className="border-t border-savo-purple-100/60 pt-4 mt-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-savo-purple mb-2">Demo accounts</p>
            <div className="space-y-2">
              <DemoCredentialRow
                label="Superadmin"
                email="admin@savomart.in"
                password="Admin@123"
                accent="purple"
                onFill={(em, pw) => { setEmail(em); setPassword(pw); setError(''); }}
              />
              <DemoCredentialRow
                label="Store manager"
                email="manager.indiranagar@savomart.in"
                password="Store@123"
                accent="sky"
                onFill={(em, pw) => { setEmail(em); setPassword(pw); setError(''); }}
              />
            </div>
            <p className="text-[10px] text-savo-ink/45 mt-2 leading-relaxed">
              Tap a row to auto-fill. Demo creds shown for take-home review only.
            </p>
          </div>
        </form>

        <p className="text-center text-xs text-white/50 mt-6">
          Looking for the customer app?{' '}
          <a href="/" className="text-savo-yellow hover:underline">
            Go to savomart.app
          </a>
        </p>
      </div>
    </div>
  );
}
