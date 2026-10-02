 'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('Zoon_theme'); } catch { /* Storage may be disabled. */ }
      const next = saved === 'dark' || (saved !== 'light' && media.matches);
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      setDark(next);
    };
    sync();
    setReady(true);
    media.addEventListener('change', sync);
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === 'Zoon_theme') sync(); };
    window.addEventListener('storage', onStorage);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', onStorage); };
  }, []);
  const toggle = () => {
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('Zoon_theme', next ? 'dark' : 'light'); } catch { /* Keep the current page usable without storage. */ }
  };
  const label = `Switch to ${dark ? 'light' : 'dark'} theme`;
  return <button type="button" disabled={!ready} onClick={toggle} className={`${inline ? "relative" : "fixed bottom-5 right-5 z-[90]"} grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-xl transition hover:-translate-y-0.5 disabled:opacity-50`} aria-label={label} title={label}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
