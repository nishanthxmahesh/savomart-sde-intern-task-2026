import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BANGALORE_CENTER = [12.9716, 77.5946];

// Branded purple-S marker as a divIcon — avoids Leaflet's broken default
// asset paths under Vite, and lets us style the nearest marker with a
// pulsing ring class.
function storeIcon({ pulse = false } = {}) {
  const wrap = pulse ? 'savo-marker savo-marker-pulse' : 'savo-marker';
  return L.divIcon({
    className: 'savo-marker-wrap',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
    html: `<div class="${wrap}">S</div>`,
  });
}

function FlyToStore({ store }) {
  const map = useMap();
  useEffect(() => {
    if (!store) return;
    map.flyTo([store.latitude, store.longitude], 15, { duration: 0.8 });
  }, [store, map]);
  return null;
}

function FitBounds({ stores }) {
  const map = useMap();
  useEffect(() => {
    if (!stores?.length) return;
    const bounds = L.latLngBounds(stores.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [stores, map]);
  return null;
}

function gmapsDirectionsUrl(store) {
  return `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}&destination_place_id=${encodeURIComponent(store.name)}`;
}

export default function StoreMap({
  stores,
  selectedStoreId,
  nearestStoreId,
  userLocation,
  onMarkerClick,
}) {
  const initialBounds = useMemo(() => {
    if (!stores?.length) return null;
    return L.latLngBounds(stores.map((s) => [s.latitude, s.longitude]));
  }, [stores]);

  const selected = stores?.find((s) => s.id === selectedStoreId);

  return (
    <MapContainer
      center={BANGALORE_CENTER}
      zoom={12}
      bounds={initialBounds || undefined}
      boundsOptions={{ padding: [40, 40], maxZoom: 14 }}
      scrollWheelZoom
      className="h-full w-full rounded-2xl overflow-hidden"
      style={{ minHeight: 360 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {!selectedStoreId && <FitBounds stores={stores} />}
      <FlyToStore store={selected} />

      {userLocation && (
        <CircleMarker
          center={[userLocation.latitude, userLocation.longitude]}
          radius={8}
          pathOptions={{
            color: '#782B90',
            weight: 3,
            fillColor: '#FFF200',
            fillOpacity: 1,
          }}
        >
          <Popup>You're here</Popup>
        </CircleMarker>
      )}

      {(stores || []).map((s) => (
        <Marker
          key={s.id}
          position={[s.latitude, s.longitude]}
          icon={storeIcon({ pulse: s.id === nearestStoreId })}
          eventHandlers={{
            click: () => onMarkerClick?.(s.id),
          }}
        >
          <Popup>
            <div className="space-y-1 min-w-[200px]">
              <p className="font-bold text-savo-purple text-sm">{s.name}</p>
              <p className="text-xs text-savo-ink/70 leading-snug">{s.address}</p>
              {s.hours && <p className="text-xs text-savo-ink/60">🕒 {s.hours}</p>}
              {s.phone && (
                <p className="text-xs text-savo-ink/60">
                  📞 <a href={`tel:${s.phone.replace(/\s+/g, '')}`} className="hover:underline">{s.phone}</a>
                </p>
              )}
              <a
                href={gmapsDirectionsUrl(s)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-savo-purple hover:underline"
              >
                Get directions →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
