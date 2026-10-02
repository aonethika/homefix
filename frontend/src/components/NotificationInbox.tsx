'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { platformAPI, getApiError } from '@/services/api';
export default function NotificationInbox({ inline = false }: { inline?: boolean }) {
  const user = useSelector((s: RootState) => s.auth.user);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { const r = await platformAPI.getNotifications(); setItems(r.data.data); setError(''); } catch (e) { setError(getApiError(e, 'Could not load notifications.')); } }, []);
  useEffect(() => { setItems([]); if (!user) return; load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [user?.id, load]);
  if (!user) return null;
  const count = items.filter(n => !n.read).length;
  return <div className={inline ? "relative z-50" : "fixed top-4 right-4 z-50"}><button aria-label={`Notifications, ${count} unread`} aria-expanded={open} onClick={() => { setOpen(!open); load(); }} className={inline ? "relative grid h-10 w-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)]" : "hf-panel relative grid h-11 w-11 place-items-center rounded-full shadow-lg"}><Bell size={20}/>{count > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-600 px-1 text-center text-[10px] leading-4 text-white">{count > 99 ? '99+' : count}</span>}</button>{open && <section aria-label="Notifications" style={{ top: '3rem' }} className="hf-panel absolute right-0 max-h-[65vh] w-[min(24rem,90vw)] overflow-y-auto rounded-2xl p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Notifications</h2><button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={18}/></button></div>{error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}{count > 0 && <button className="my-3 text-sm text-blue-500" onClick={async () => { try { await platformAPI.markNotificationsRead(); await load(); } catch (e) { setError(getApiError(e, 'Could not update notifications.')); } }}>Mark all as read</button>}{items.length === 0 && !error && <p className="my-4 text-sm">You are all caught up. Appointment reminders will appear here.</p>}{items.map(n => <article key={n.id} className={`mt-3 rounded-xl border border-[var(--border)] p-3 ${!n.read ? 'bg-blue-500/10' : ''}`}><p className="text-sm font-bold">{n.title}</p><p className="mt-1 text-sm">{n.message}</p>{n.data?.scheduledAt && <p className="mt-2 text-sm font-semibold">{new Date(n.data.scheduledAt).toLocaleString()}</p>}<time className="mt-2 block text-xs text-[var(--muted)]">{new Date(n.createdAt).toLocaleString()}</time>{n.data?.requestId && <Link onClick={() => setOpen(false)} className="mt-2 block text-sm text-blue-500" href={`/bookings/${encodeURIComponent(n.data.requestId)}`}>Open booking</Link>}</article>)}</section>}</div>;
}
