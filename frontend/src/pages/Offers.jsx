import { useMemo, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { useDebounced } from '../hooks/useDebounced';
import { fetchOffers } from '../api/offers';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import FilterChips from '../components/FilterChips';
import OfferCard from '../components/OfferCard';
import { SkeletonBlock } from '../components/Skeleton';

const SCOPE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Sitewide', value: 'sitewide' },
  { label: 'Store-only', value: 'specific' },
  { label: 'Expiring soon', value: 'expiring' },
  { label: 'For me', value: 'eligible' },
];

function paramsFor(scope) {
  switch (scope) {
    case 'sitewide':
      return { scope: 'sitewide' };
    case 'specific':
      return { scope: 'specific' };
    case 'expiring':
      return { expiring_soon: true };
    case 'eligible':
      return { eligible_only: true };
    default:
      return {};
  }
}

export default function Offers() {
  const [scope, setScope] = useState('all');
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim(), 250);

  const params = useMemo(
    () => ({
      ...paramsFor(scope),
      category: category || undefined,
      q: debouncedSearch || undefined,
    }),
    [scope, category, debouncedSearch],
  );

  const { data, loading, error, reload } = useAsync(
    () => fetchOffers(params),
    [JSON.stringify(params)],
  );

  const offers = data?.items || [];
  const categories = data?.categories || [];

  const categoryOptions = useMemo(
    () => [{ label: 'All categories', value: null }, ...categories.map((c) => ({ label: c, value: c }))],
    [categories],
  );

  return (
    <div className="min-h-full bg-savo-mist">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-24 lg:pb-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-savo-ink">Offers</h1>
            <p className="text-sm text-savo-ink/60 mt-0.5">
              {loading
                ? 'Loading the latest deals…'
                : `${data?.total ?? 0} active ${(data?.total ?? 0) === 1 ? 'offer' : 'offers'} for you`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-savo-ink/40" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers — try 'atta', 'dairy', or 'free delivery'"
            className="savo-input pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-savo-ink/40 hover:text-savo-purple"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scope chips */}
        <FilterChips options={SCOPE_OPTIONS} value={scope} onChange={setScope} />

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="mt-2">
            <FilterChips options={categoryOptions} value={category} onChange={setCategory} />
          </div>
        )}

        {/* Results */}
        <div className="mt-5">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="savo-card p-6 text-center">
              <p className="text-savo-ink/70">Couldn't load offers right now.</p>
              <button onClick={reload} className="mt-3 savo-btn-primary px-4 py-2 text-sm">
                Retry
              </button>
            </div>
          ) : offers.length === 0 ? (
            <div className="savo-card p-8 text-center">
              <div className="text-4xl mb-2">🪐</div>
              <p className="font-semibold text-savo-ink">No offers match your filters.</p>
              <p className="text-sm text-savo-ink/60 mt-1">Try clearing your search or switching to "All".</p>
              <button
                onClick={() => {
                  setScope('all');
                  setCategory(null);
                  setSearch('');
                }}
                className="mt-4 savo-btn-secondary px-4 py-2 text-sm"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-fade-in">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
