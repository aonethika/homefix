'use client';
import { useEffect, useState } from 'react';
import { emitWorkerLocation } from './useSocket';
export type LivePosition = { lat: number; lon: number; accuracy: number; updatedAt: string };
export function useLivePosition(enabled: boolean) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) { setPosition(null); setError(''); return; }
    if (!navigator.geolocation) { setError('Location sharing is not available in this browser.'); return; }
    let active = true;
    const onPosition = ({ coords, timestamp }: GeolocationPosition) => {
      if (!active) return;
      setError(''); setPosition({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy, updatedAt: new Date(timestamp).toISOString() });
      emitWorkerLocation(coords.latitude, coords.longitude, coords.accuracy);
    };
    const onError = () => { if (active) setError('Allow location access to share your position and see the route. Keep this page open while travelling.'); };
    const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };
    const watch = navigator.geolocation.watchPosition(onPosition, onError, options);
    const timer = window.setInterval(() => navigator.geolocation.getCurrentPosition(onPosition, onError, options), 15000);
    return () => { active = false; navigator.geolocation.clearWatch(watch); clearInterval(timer); };
  }, [enabled]);
  return { position, error };
}
