import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';

const DESKTOP_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/offers', label: 'Offers' },
  { to: '/stores', label: 'Stores' },
  { to: '/support', label: 'Support' },
];

function initialsOf(name) {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
}

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-savo-purple-100/60">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/" className="shrink-0">
          <Logo size="sm" />
        </NavLink>

        {/* Desktop nav (lg+) */}
        <nav className="hidden lg:flex items-center gap-1 ml-2 mr-auto">
          {DESKTOP_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  isActive
                    ? 'bg-savo-purple text-savo-yellow'
                    : 'text-savo-ink/65 hover:text-savo-purple hover:bg-savo-purple-50'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-11 h-11 rounded-full bg-savo-purple text-savo-yellow grid place-items-center font-bold text-sm hover:scale-105 transition shadow-savo-glow"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Account menu for ${user?.name || 'user'}`}
              title={user?.name}
            >
              {initialsOf(user?.name)}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 savo-card overflow-hidden animate-slide-up"
              >
                <div className="px-4 py-3 border-b border-savo-purple-100/60">
                  <p className="text-sm font-bold text-savo-ink truncate">{user?.name || 'Savo shopper'}</p>
                  <p className="text-xs text-savo-ink/55 font-mono">+91 {user?.mobile_number || ''}</p>
                </div>
                <button
                  onClick={handleLogout}
                  role="menuitem"
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
