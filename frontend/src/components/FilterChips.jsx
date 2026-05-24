export default function FilterChips({ options, value, onChange, scrollable = true }) {
  return (
    <div
      className={
        scrollable
          ? 'flex gap-2 overflow-x-auto savo-scroll-x pb-1 -mx-4 px-4 snap-x'
          : 'flex flex-wrap gap-2'
      }
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value ?? 'all'}
            onClick={() => onChange(opt.value)}
            className={`snap-start shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
              active
                ? 'bg-savo-purple text-savo-yellow border-savo-purple shadow-savo-glow'
                : 'bg-white text-savo-ink/70 border-savo-purple-100 hover:border-savo-purple hover:text-savo-purple'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className={`ml-1.5 text-[10px] ${active ? 'text-savo-yellow/80' : 'text-savo-ink/40'}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
