import { useMemo, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchStores } from '../api/stores';
import { haversineKm } from '../utils/haversine';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import StoreMap from '../components/StoreMap';
import StoreList from '../components/StoreList';
import { SkeletonBlock } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function Stores() {
  const { data, loading } = useAsync(fetchStores);
  const stores = data?.items || [];
  const source = data?.source;

  const [query, setQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [mobileView, setMobileView] = useState('map'); // 'map' | 'list'
  const geo = useGeolocation();
  const { show } = useToast();

  // Decorate with distance + sort by distance when geolocation is available
  const enriched = useMemo(() => {
    if (!geo.coords) return stores.map((s) => ({ ...s, distance_km: null }));
    return stores
      .map((s) => ({
        ...s,
        distance_km: haversineKm(
          geo.coords.latitude,
          geo.coords.longitude,
          s.latitude,
          s.longitude,
        ),
      }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }, [stores, geo.coords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((s) => {
      const hay = `${s.name} ${s.address} ${s.area || ''} ${s.city || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, query]);

  const nearestStoreId = geo.coords && enriched.length ? enriched[0].id : null;

  const handleFindNearest = async () => {
    try {
      await geo.request();
      show('Nearest store found', { kind: 'success', timeoutMs: 1800 });
    } catch (err) {
      if (geo.error) show(geo.error, { kind: 'error' });
    }
  };

  // When the user toggles to list view on mobile after picking a store, keep
  // selection in sync visually.
  const handleSelect = (id) => {
    setSelectedStoreId(id);
    // On phones (no md+ side-by-side), bring the map back into view.
    if (window.innerWidth < 768) setMobileView('map');
  };

  return (
    <div className="min-h-full bg-savo-mist flex flex-col">
      <AppHeader />

      <main className="max-w-6xl w-full mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-24 lg:pb-10 flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-savo-ink">Find a store</h1>
            <p className="text-sm text-savo-ink/60 mt-0.5">
              {loading
                ? 'Loading stores…'
                : `${enriched.length} ${enriched.length === 1 ? 'store' : 'stores'} near you`}
              {source === 'fallback' && (
                <span className="ml-2 text-[11px] text-savo-ink/40 italic">· offline catalogue</span>
              )}
            </p>
          </div>

          <button
            onClick={handleFindNearest}
            disabled={geo.loading}
            className="savo-btn-primary text-sm px-4 py-2"
          >
            {geo.loading ? (
              <span className="inline-block w-4 h-4 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                </svg>
                {geo.coords ? 'Re-check' : 'Find nearest store'}
              </>
            )}
          </button>
        </div>

        {/* View toggle (mobile only — md+ shows sidebar + map together) */}
        <div className="md:hidden mb-3 flex rounded-xl border border-savo-purple-100 bg-white p-1 text-sm">
          {['map', 'list'].map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={`flex-1 px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                mobileView === v
                  ? 'bg-savo-purple text-savo-yellow'
                  : 'text-savo-ink/60 hover:text-savo-purple'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex-1 grid md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] gap-4 min-h-0">
          {/* Sidebar */}
          <aside
            className={`min-h-0 flex flex-col ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex`}
            style={{ minHeight: 360 }}
          >
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <StoreList
                stores={filtered}
                selectedStoreId={selectedStoreId}
                nearestStoreId={nearestStoreId}
                onSelect={handleSelect}
                query={query}
                onQuery={setQuery}
                hasGeolocation={!!geo.coords}
              />
            )}
          </aside>

          {/* Map */}
          <section
            className={`min-h-[360px] md:min-h-0 ${mobileView === 'map' ? 'block' : 'hidden'} md:block`}
          >
            {loading ? (
              <SkeletonBlock className="h-full w-full min-h-[360px]" />
            ) : (
              <div className="h-full min-h-[360px] rounded-2xl overflow-hidden shadow-savo-card border border-savo-purple-100/60">
                <StoreMap
                  stores={filtered}
                  selectedStoreId={selectedStoreId}
                  nearestStoreId={nearestStoreId}
                  userLocation={geo.coords}
                  onMarkerClick={setSelectedStoreId}
                />
              </div>
            )}
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
