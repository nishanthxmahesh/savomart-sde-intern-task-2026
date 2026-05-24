import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true,
    icon: <path d="M3 12l9-9 9 9M5 10v10h14V10" /> },
  { to: '/admin/offers', label: 'Offers',
    icon: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></> },
  { to: '/admin/coupons', label: 'Coupons',
    icon: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V8z"/><line x1="9" y1="9" x2="9" y2="15"/></> },
  { to: '/admin/points', label: 'Points',
    icon: <><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></> },
  { to: '/admin/tickets', label: 'Tickets',
    icon: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></> },
  { to: '/admin/users', label: 'Users',
    icon: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></> },
  { to: '/admin/analytics', label: 'Analytics',
    icon: <><line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="10" width="3" height="8"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/></> },
];

function initialsOf(name, email) {
  const src = (name || email || 'A').trim();
  const parts = src.split(/\s+|[@.]/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2) || 'A';
}

export default function AdminLayout() {
  const { admin, logout, isSuperadmin } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const allowedForRole = (label) => {
    // Store managers see Dashboard / Offers (limited) / Tickets (their own) /
    // Users (read) / Analytics. Points + Coupons are superadmin-only ops.
    if (isSuperadmin) return true;
    if (['Points', 'Coupons'].includes(label)) return false;
    return true;
  };

  return (
    <div className="min-h-full bg-slate-50 flex">
      {/* Sidebar — desktop fixed, mobile overlay */}
      <aside
        className={`${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static z-40 inset-y-0 left-0 w-64 bg-savo-ink text-white flex flex-col transition-transform`}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <NavLink to="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-lg bg-savo-yellow text-savo-purple grid place-items-center font-extrabold">
              S
            </div>
            <div>
              <p className="font-extrabold leading-tight">SAVO<span className="text-savo-yellow">admin</span></p>
              <p className="text-[10px] text-white/55 uppercase tracking-widest">Ops console</p>
            </div>
          </NavLink>
          <button
            className="md:hidden w-9 h-9 grid place-items-center rounded-md hover:bg-white/10"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item) => {
            const allowed = allowedForRole(item.label);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? 'bg-savo-purple text-savo-yellow'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  } ${!allowed ? 'opacity-40 pointer-events-none' : ''}`
                }
                title={!allowed ? 'Superadmin only' : ''}
              >
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
                <span>{item.label}</span>
                {!allowed && (
                  <span className="ml-auto text-[9px] uppercase tracking-wider bg-white/10 px-1.5 py-0.5 rounded">
                    Pro
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-savo-purple text-savo-yellow grid place-items-center font-bold text-sm">
              {initialsOf(admin?.name, admin?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{admin?.name || admin?.email}</p>
              <p className="text-[11px] text-white/55 truncate">
                <span className={`inline-flex items-center gap-1 ${isSuperadmin ? 'text-savo-yellow' : 'text-sky-300'}`}>
                  ● {isSuperadmin ? 'superadmin' : 'store manager'}
                </span>
                {admin?.store_id && <span className="ml-1">· {admin.store_id}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs font-semibold text-white/70 hover:text-red-400 hover:bg-white/5 px-2 py-2 rounded transition"
          >
            Log out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-10 h-10 grid place-items-center rounded-lg hover:bg-slate-100"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="font-bold text-savo-purple">SAVO<span className="text-savo-ink">admin</span></span>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
