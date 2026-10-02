'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, LocateFixed, Loader2, MapPin, Search } from 'lucide-react';

export type PickedLocation = { address: string; latitude: number; longitude: number };
type SearchResult = { place_id: number; display_name: string; lat: string; lon: string };

export default function LocationPicker({ value, onChange }: { value?: Partial<PickedLocation>; onChange: (location: PickedLocation) => void }) {
  const [query, setQuery] = useState(value?.address || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Partial<PickedLocation> | undefined>(value);
  const [editing, setEditing] = useState(value?.latitude == null);
  const inputId = useId();
  const operation = useRef(0);
  const searchRef = useRef<AbortController | null>(null);

  useEffect(() => () => { operation.current++; searchRef.current?.abort(); }, []);
  useEffect(() => {
    setSelected(value);
    setQuery(value?.address || '');
    setEditing(value?.latitude == null);
  }, [value?.address, value?.latitude, value?.longitude]);

  useEffect(() => {
    setResults([]);
    setSearching(false);
    if (!editing || locating || query.trim().length < 3 || query === selected?.address) return;
    const controller = new AbortController();
    searchRef.current = controller;
    const timer = window.setTimeout(async () => {
      setSearching(true); setError('');
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
        if (!response.ok) throw new Error('Search unavailable');
        const items: SearchResult[] = await response.json();
        if (!controller.signal.aborted) {
          setResults(items);
          if (!items.length) setError('No addresses found. Try a nearby street or postcode.');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError('Address search is unavailable. Try again or use your current location.');
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 600);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, editing, locating, selected?.address]);

  const pick = (location: PickedLocation) => {
    operation.current++;
    searchRef.current?.abort();
    setSelected(location); setQuery(location.address); setResults([]);
    setSearching(false); setLocating(false); setEditing(false); setError('');
    onChange(location);
  };

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser. Search for your address instead.'); return; }
    const request = ++operation.current;
    searchRef.current?.abort(); setResults([]); setSearching(false);
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (request !== operation.current) return;
      let address = `Pinned location (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`;
      const controller = new AbortController();
      searchRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
        if (response.ok) address = (await response.json()).display_name || address;
      } catch { /* Coordinates remain usable if address lookup fails. */ }
      finally { window.clearTimeout(timeout); }
      if (request === operation.current) pick({ address, latitude: coords.latitude, longitude: coords.longitude });
    }, error => {
      if (request !== operation.current) return;
      setLocating(false);
      setError(error.code === 1 ? 'Location access was denied. Search for your address below.' : 'Could not get your location. Try again or search for your address.');
    }, { enableHighAccuracy: true, timeout: 12000 });
  };

  if (!editing && selected?.latitude != null) return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
      <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--muted)]">Service location</p><p className="mt-1 break-words text-sm text-[var(--text)]">{selected.address}</p></div>
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-[var(--brand)] underline underline-offset-4">Change</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div><label htmlFor={inputId} className="text-sm font-semibold text-[var(--text)]">Where do you need service?</label><p id={`${inputId}-help`} className="mt-1 text-xs leading-5 text-[var(--muted)]">Choose an address so we can find professionals nearby.</p></div>
      <button type="button" onClick={locate} disabled={locating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--soft)] disabled:opacity-60">
        {locating ? <Loader2 className="animate-spin" size={17} /> : <LocateFixed size={17} />}{locating ? 'Finding your location...' : 'Use current location'}
      </button>
      <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 text-[var(--muted)]" size={17} /><input id={inputId} value={query} disabled={locating} onChange={event => { searchRef.current?.abort(); setResults([]); setSearching(false); setError(''); setQuery(event.target.value); }} placeholder="Or search street, area or postcode" autoComplete="off" aria-describedby={`${inputId}-help`} className="hf-input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} />{searching && <Loader2 size={17} className="absolute right-3.5 top-3.5 animate-spin text-[var(--muted)]" />}</div>
      {results.length > 0 && <ul aria-label="Matching addresses" className="max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">{results.map(item => <li key={item.place_id}><button type="button" onClick={() => pick({ address: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) })} className="flex min-h-11 w-full gap-3 rounded-lg px-3 py-3 text-left text-sm leading-5 text-[var(--text)] hover:bg-[var(--soft)]"><MapPin size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" /><span>{item.display_name}</span></button></li>)}</ul>}
      <div aria-live="polite">{error ? <p className="text-xs text-rose-600">{error}</p> : searching ? <p className="text-xs text-[var(--muted)]">Searching addresses...</p> : null}</div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]"><span>Search results ? OpenStreetMap contributors.</span>{selected?.latitude != null && <button type="button" onClick={() => { operation.current++; searchRef.current?.abort(); setLocating(false); setError(''); setQuery(selected.address || ''); setEditing(false); }} className="font-semibold text-[var(--brand)]">Cancel</button>}</div>
    </div>
  );
}
