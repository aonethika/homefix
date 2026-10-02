'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';

type Point = { lat: number; lon: number };

declare global {
  interface Window { L?: any; }
}

function distanceKm(a: Point, b: Point) {
  const radius = 6371;
  const latitude = (b.lat - a.lat) * Math.PI / 180;
  const longitude = (b.lon - a.lon) * Math.PI / 180;
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(longitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export default function LiveTrackingMap({ worker, customer, workerName = 'Your professional', updatedAt, accuracy, navigation = false }: { worker: Point; customer: Point; workerName?: string; updatedAt?: string; accuracy?: number; navigation?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const workerMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [route, setRoute] = useState<any>(null);
  const [routeError, setRouteError] = useState(false);
  const positionRef = useRef({ worker, customer });
  positionRef.current = { worker, customer };
  const fresh = !!updatedAt && now - new Date(updatedAt).getTime() < 45000;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let controller: AbortController | null = null;
    let disposed = false;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      controller = new AbortController();
      const { worker: origin, customer: destination } = positionRef.current;
      const timeout = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const host = process.env.NEXT_PUBLIC_ROUTING_URL || 'https://router.project-osrm.org';
        const response = await fetch(`${host}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) throw new Error('Route unavailable');
        if (!disposed) { setRoute(data.routes[0]); setRouteError(false); }
      } catch { if (!disposed) { setRoute(null); setRouteError(true); } }
      finally { clearTimeout(timeout); busy = false; }
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { disposed = true; controller?.abort(); clearInterval(timer); };
  }, [customer.lat, customer.lon]);
  const distance = useMemo(() => distanceKm(worker, customer), [worker, customer]);

  useEffect(() => {
    const stylesheetId = 'Zoon-leaflet-css';
    if (!document.getElementById(stylesheetId)) {
      const link = document.createElement('link');
      link.id = stylesheetId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (window.L) { setReady(true); return; }
    const existing = document.getElementById('Zoon-leaflet-js') as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    const loaded = () => setReady(true);
    const failed = () => setMapError(true);
    script.addEventListener('load', loaded);
    script.addEventListener('error', failed);
    if (!existing) {
      script.id = 'Zoon-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      document.body.appendChild(script);
    }
    return () => { script.removeEventListener('load', loaded); script.removeEventListener('error', failed); };
  }, []);

  useEffect(() => {
    if (!ready || !window.L || !containerRef.current) return;
    const L = window.L;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(mapRef.current);
      const workerIcon = L.divIcon({ className: '', html: '<div style="width:34px;height:34px;border-radius:14px;background:#2563eb;color:white;display:grid;place-items:center;border:3px solid white;box-shadow:0 8px 22px rgba(124,58,237,.45);font-size:14px;font-weight:700">P</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
      const homeIcon = L.divIcon({ className: '', html: '<div style="width:30px;height:30px;border-radius:50%;background:#ec4899;color:white;display:grid;place-items:center;border:3px solid white;box-shadow:0 8px 22px rgba(236,72,153,.4);font-size:14px;font-weight:700">H</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
      const label = document.createElement('span'); label.textContent = navigation ? 'Your location' : workerName;
      workerMarkerRef.current = L.marker([worker.lat, worker.lon], { icon: workerIcon }).addTo(mapRef.current).bindTooltip(label);
      customerMarkerRef.current = L.marker([customer.lat, customer.lon], { icon: homeIcon }).addTo(mapRef.current).bindTooltip('Service location');
      routeRef.current = L.polyline([], { color: '#3b82f6', weight: 5 }).addTo(mapRef.current);
      mapRef.current.fitBounds([[worker.lat, worker.lon], [customer.lat, customer.lon]], { padding: [45, 45], maxZoom: 16 });
    } else {
      workerMarkerRef.current?.setLatLng([worker.lat, worker.lon]);
      customerMarkerRef.current?.setLatLng([customer.lat, customer.lon]);
    }
    routeRef.current?.setLatLngs(route?.geometry?.coordinates?.map(([lon, lat]: number[]) => [lat, lon]) || []);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 50);
  }, [ready, worker.lat, worker.lon, customer.lat, customer.lon, workerName, route, navigation]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  const distanceLabel = distance < 0.1 ? 'Near the service location (GPS estimate)' : `${distance.toFixed(1)} km straight-line distance`;
  return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div><p className="flex items-center gap-2 text-sm font-bold text-[var(--text)]"><LocateFixed size={16}/>{navigation ? 'Route to customer' : `${workerName} location`}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{fresh && route ? `${(route.distance / 1000).toFixed(1)} km by road - about ${Math.max(1, Math.ceil(route.duration / 60))} min (without live traffic)` : distanceLabel}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">{fresh ? 'Location updated recently' : 'Location is stale. Waiting for a new GPS update.'}{accuracy != null ? ` - GPS accuracy +/-${Math.round(accuracy)} m` : ''}</p>
      </div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${fresh ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{fresh ? 'LIVE' : 'LAST KNOWN'}</span>
    </div>
    <div ref={containerRef} className="h-64 w-full bg-slate-200">{!ready && <div className="grid h-full place-items-center text-xs text-slate-500">{mapError ? 'Map could not load. Check your connection.' : 'Loading map...'}</div>}</div>
    <div className="space-y-2 p-3 text-xs text-[var(--muted)]">
      {routeError && <p>Road directions are unavailable. Showing GPS locations only.</p>}
      <button className="font-bold text-blue-500" onClick={() => mapRef.current?.fitBounds([[worker.lat, worker.lon], [customer.lat, customer.lon]], { padding: [45, 45], maxZoom: 16 })}>Recenter map</button>
      {navigation && route && <details><summary className="cursor-pointer font-bold">Route directions</summary><ol className="mt-2 max-h-48 list-decimal space-y-2 overflow-y-auto pl-5">{route.legs?.flatMap((leg: any) => leg.steps || []).map((step: any, index: number) => <li key={index}>{String(step.maneuver?.type || 'Continue').replaceAll('_', ' ')} {step.maneuver?.modifier || ''}{step.name ? ` onto ${step.name}` : ''} - {Math.round(step.distance)} m</li>)}</ol></details>}
    </div>
  </div>;
}
