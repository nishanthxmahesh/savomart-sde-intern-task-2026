import { formatKm } from '../utils/haversine';

function gmapsDirectionsUrl(s) {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`;
}

export default function StoreList({
  stores,
  selectedStoreId,
  nearestStoreId,
  onSelect,
  query,
  onQuery,
  hasGeolocation,
  emptyText = 'No stores match your search.',
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-savo-ink/40" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name or area"
          className="savo-input pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => onQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-savo-ink/40 hover:text-savo-purple"
          >
            ✕
          </button>
        )}
      </div>

      {stores.length === 0 ? (
        <div className="savo-card p-6 text-center text-sm text-savo-ink/60">{emptyText}</div>
      ) : (
        <ul className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 pb-2">
          {stores.map((s) => {
            const isSelected = s.id === selectedStoreId;
            const isNearest = s.id === nearestStoreId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => onSelect(s.id)}
                  className={`w-full text-left p-3 rounded-xl border transition group ${
                    isSelected
                      ? 'bg-savo-purple-50 border-savo-purple shadow-savo-glow'
                      : 'bg-white border-savo-purple-100/60 hover:border-savo-purple hover:bg-savo-purple-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-savo-ink text-sm truncate">{s.name}</p>
                        {isNearest && hasGeolocation && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-savo-yellow text-savo-purple px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            Nearest
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-savo-ink/60 line-clamp-2 leading-snug">
                        {s.address}
                      </p>
                      {s.hours && (
                        <p className="mt-1 text-[11px] text-savo-ink/45">{s.hours}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {typeof s.distance_km === 'number' && (
                        <span
                          className={`block text-xs font-bold tabular-nums ${
                            isNearest ? 'text-savo-purple' : 'text-savo-ink/70'
                          }`}
                        >
                          {formatKm(s.distance_km)}
                        </span>
                      )}
                      <a
                        href={gmapsDirectionsUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-block text-[11px] font-semibold text-savo-purple opacity-0 group-hover:opacity-100 transition"
                      >
                        Directions →
                      </a>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
