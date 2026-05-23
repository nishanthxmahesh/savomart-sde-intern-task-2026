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

export default function TransactionRow({ txn }) {
  const earned = txn.delta >= 0;
  return (
    <li className="flex items-center gap-3 py-3 border-b border-savo-purple-100/40 last:border-b-0">
      <div
        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
          earned ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}
        aria-hidden
      >
        {earned ? '↑' : '↓'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-savo-ink truncate">{txn.description}</p>
        <p className="text-xs text-savo-ink/50">{formatRelative(txn.created_at)}</p>
      </div>
      <span
        className={`shrink-0 text-sm font-bold tabular-nums ${
          earned ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {earned ? '+' : ''}
        {txn.delta.toLocaleString('en-IN')}
      </span>
    </li>
  );
}
