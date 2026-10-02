'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { requestAPI, getApiError } from '@/services/api';
import LiveTrackingMap from './LiveTrackingMap';
import type { LivePosition } from '@/hooks/useLivePosition';

export default function RequestTracker({ request, position, professional = false, locationError }: { request: any; position?: LivePosition | null; professional?: boolean; locationError?: string }) {
  const [sample, setSample] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState(request.status);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { setStatus(request.status); }, [request.status]);
  const tracking = ['ACCEPTED', 'IN_PROGRESS'].includes(status) && request.bookingStage !== 'READY';
  useEffect(() => {
    if (!tracking) { setSample(null); return; }
    let active = true;
    const refresh = async () => {
      try { const { data } = await requestAPI.tracking(request.id); if (active) { setStatus(data.data.status); setSample(data.data.location); setError(''); setUnavailable(false); } }
      catch (error: any) { if (active) { setError(getApiError(error, 'Could not refresh tracking.')); setUnavailable(true); } }
    };
    const listener = (event: Event) => { const location = (event as CustomEvent).detail; if (active && location?.requestId === request.id) { setSample(location); setUnavailable(false); } };
    refresh(); const timer = window.setInterval(refresh, 10000);
    window.addEventListener('zoon:worker-location', listener);
    return () => { active = false; clearInterval(timer); window.removeEventListener('zoon:worker-location', listener); };
  }, [request.id, tracking]);
  const worker = professional ? position : sample;
  return <section className="space-y-3" aria-label="In-app tracking">
    {!tracking ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">Live tracking is available for accepted jobs. It stops when the booking is closed.</div> : <>
      {locationError && <p role="status" className="rounded-xl bg-[var(--soft)] p-3 text-sm text-[var(--warning)]">{locationError}</p>}
      {error && <p role="status" className="text-sm text-[var(--danger)]">{error}</p>}
      {worker && !unavailable && request.userLatitude != null && request.userLongitude != null ? <LiveTrackingMap navigation={professional} worker={worker} customer={{ lat: Number(request.userLatitude), lon: Number(request.userLongitude) }} workerName={request.worker?.user?.name} updatedAt={worker.updatedAt} accuracy={worker.accuracy} /> : <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center"><Navigation size={28} className="text-[var(--brand)]" /><h2 className="mt-4 font-semibold">{request.userLatitude == null ? 'Service map pin unavailable' : 'Waiting for a live location'}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">{request.userLatitude == null ? 'Confirm the service address in your conversation.' : professional ? 'Allow GPS access and keep zoon open to share your journey.' : 'Your professional needs to keep zoon open and allow location access. New positions will appear here.'}</p></div>}
      <div className="flex items-start gap-3 rounded-xl bg-[var(--soft)] p-4"><MapPin size={18} className="mt-0.5 shrink-0 text-[var(--brand)]" /><div><p className="text-xs font-semibold text-[var(--muted)]">Service address</p><p className="mt-1 text-sm">{request.userAddress || 'Confirm the address in chat'}</p></div></div>
    </>}
  </section>;
}
