// Small shared admin UI primitives.
import { useEffect, useRef } from 'react';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-savo-ink">{title}</h1>
        {subtitle && <p className="text-sm text-savo-ink/60 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, accent = 'purple' }) {
  const accents = {
    purple: 'from-savo-purple to-savo-purple-dark text-savo-yellow',
    yellow: 'from-savo-yellow to-amber-300 text-savo-purple',
    ink: 'from-savo-ink to-slate-700 text-white',
    emerald: 'from-emerald-500 to-emerald-700 text-white',
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 bg-gradient-to-br shadow-savo-card ${accents[accent]}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-75">{hint}</p>}
    </div>
  );
}

export function DataTable({ columns, rows, emptyText = 'Nothing here yet.', onRowClick }) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-savo-ink/55 py-10 bg-white rounded-2xl border border-slate-200">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-savo-ink/55 bg-slate-50 border-b border-slate-200">
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2.5 font-bold whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.key ?? i}
              onClick={onRowClick ? () => onRowClick(row.data ?? row) : undefined}
              className={`border-b border-slate-100 last:border-b-0 ${
                onRowClick ? 'cursor-pointer hover:bg-savo-purple-50/50' : ''
              }`}
            >
              {columns.map((c, j) => (
                <td key={j} className="px-3 py-2.5 align-middle">
                  {c.render ? c.render(row.data ?? row) : (row.data ?? row)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
      <div
        ref={dialogRef}
        className={`bg-white w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-2xl animate-slide-up`}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-bold text-savo-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-savo-ink/75 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="savo-btn-secondary text-sm">Cancel</button>
        <button
          onClick={onConfirm}
          className={`savo-btn text-sm px-4 ${
            danger
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-savo-purple text-savo-yellow hover:bg-savo-purple-dark'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, hint, error, children, required = false }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-savo-ink/55">
          {label}{required && <span className="text-red-500"> *</span>}
        </span>
        {hint && <span className="text-[11px] text-savo-ink/45">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

export function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDateOnly(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relTime(iso) {
  const t = new Date(iso);
  const diff = Date.now() - t.getTime();
  const hr = Math.floor(diff / 3600000);
  if (hr < 1) return 'just now';
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
