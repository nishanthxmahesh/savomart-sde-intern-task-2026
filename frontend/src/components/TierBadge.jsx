const TIER_STYLES = {
  Bronze: {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
    label: 'Bronze',
  },
  Silver: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    label: 'Silver',
  },
  Gold: {
    bg: 'bg-savo-yellow-soft',
    text: 'text-amber-900',
    border: 'border-savo-yellow',
    dot: 'bg-amber-500',
    label: 'Gold',
    glow: true,
  },
};

export default function TierBadge({ tier, size = 'md', className = '' }) {
  const s = TIER_STYLES[tier] || TIER_STYLES.Bronze;
  const sizeCls = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${s.bg} ${s.text} ${s.border} ${sizeCls} ${
        s.glow ? 'shadow-[0_0_18px_-4px_rgba(255,242,0,0.7)]' : ''
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
