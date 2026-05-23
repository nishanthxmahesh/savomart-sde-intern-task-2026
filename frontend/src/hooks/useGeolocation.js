import { useCallback, useState } from 'react';

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Your browser does not support geolocation.');
      return Promise.reject(new Error('no_geolocation'));
    }
    setLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCoords(next);
          setLoading(false);
          resolve(next);
        },
        (err) => {
          setLoading(false);
          let msg = 'Could not get your location.';
          if (err.code === 1) msg = 'Location permission denied. Enable it in your browser to find the nearest store.';
          else if (err.code === 2) msg = "We couldn't pin your location right now. Try again in a moment.";
          else if (err.code === 3) msg = 'Location request timed out.';
          setError(msg);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setError(null);
  }, []);

  return { coords, loading, error, request, clear };
}
