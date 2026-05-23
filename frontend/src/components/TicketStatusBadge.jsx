const STATUS_STYLES = {
  open: {
    label: 'Open',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  'in-progress': {
    label: 'In progress',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export default function TicketStatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
