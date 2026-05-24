function formatRelative(iso) {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFullDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function TransactionRow({ txn, expanded, onToggle }) {
  const earned = txn.delta >= 0;
  return (
    <li className="border-b border-savo-purple-100/40 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 text-left hover:bg-savo-purple-50/40 active:bg-savo-purple-50 -mx-2 px-2 rounded-lg transition"
        aria-expanded={!!expanded}
      >
        <div
          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-base font-bold ${
            earned ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}
          aria-hidden
        >
          {earned ? '↑' : '↓'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-savo-ink ${expanded ? '' : 'truncate'}`}>
            {txn.description}
          </p>
          <p className="text-xs text-savo-ink/50 mt-0.5">{formatRelative(txn.created_at)}</p>
        </div>
        <span
          className={`shrink-0 text-base font-extrabold tabular-nums ${
            earned ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {earned ? '+' : ''}
          {txn.delta.toLocaleString('en-IN')}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-savo-ink/35 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="pb-3 pl-13 pr-1 -mt-1 animate-fade-in">
          <div className="ml-12 rounded-lg bg-savo-purple-50/60 border border-savo-purple-100/60 p-3 text-xs space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-savo-ink/55 font-semibold">When</span>
              <span className="text-savo-ink text-right">{formatFullDate(txn.created_at)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-savo-ink/55 font-semibold">Type</span>
              <span className={`font-bold ${earned ? 'text-emerald-700' : 'text-red-700'}`}>
                {earned ? 'Points earned' : 'Points redeemed'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-savo-ink/55 font-semibold">Amount</span>
              <span className={`font-extrabold tabular-nums ${earned ? 'text-emerald-700' : 'text-red-700'}`}>
                {earned ? '+' : ''}{txn.delta.toLocaleString('en-IN')} pts
              </span>
            </div>
            <div className="pt-1 border-t border-savo-purple-100/60">
              <span className="text-savo-ink/55 font-semibold">Details</span>
              <p className="mt-0.5 text-savo-ink leading-relaxed">{txn.description}</p>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
