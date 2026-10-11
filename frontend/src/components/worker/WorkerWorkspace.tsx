'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { CalendarDays, ClipboardList, History, LayoutDashboard, Menu, UserRound, Wrench, X } from 'lucide-react';
import { AppDispatch, RootState } from '@/store';
import { fetchWorkerRequests } from '@/store/requestSlice';
import { fetchProfile, updateUser } from '@/store/authSlice';
import { workerAPI, getApiError } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { LivePosition, useLivePosition } from '@/hooks/useLivePosition';
import Brand from '../Brand';
import WorkspaceTools from '../WorkspaceTools';
import LogoutButton from '../LogoutButton';
import { notify } from '../NotificationToast';

const navigation = [
  { href: '/worker', label: 'Overview', Icon: LayoutDashboard },
  { href: '/worker/requests', label: 'New requests', Icon: ClipboardList },
  { href: '/worker/jobs', label: 'Active jobs', Icon: Wrench },
  { href: '/worker/appointments', label: 'Appointments', Icon: CalendarDays },
  { href: '/worker/history', label: 'Job history', Icon: History },
  { href: '/worker/profile', label: 'My profile', Icon: UserRound },
];
type Workspace = { user: NonNullable<RootState['auth']['user']>; requests: any[]; loading: boolean; error: string | null; stats: any; position: LivePosition | null; locationError: string; refresh: () => Promise<void> };
const Context = createContext<Workspace | null>(null);
export const useWorkerWorkspace = () => { const value = useContext(Context); if (!value) throw new Error('Worker workspace is required'); return value; };
export default function WorkerWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);
  const { workerRequests, loading, error } = useSelector((s: RootState) => s.request);
  const [stats, setStats] = useState<any>(null); const [menu, setMenu] = useState(false); const [toggling, setToggling] = useState(false); const [now, setNow] = useState(Date.now());
  useSocket(token, user?.role);
  const refresh = useCallback(async () => { await dispatch(fetchWorkerRequests()); try { setStats((await workerAPI.getStats()).data.data.stats); } catch {} }, [dispatch]);
  useEffect(() => {
    if (!token || !user) { router.replace('/professional-login'); return; }
    if (user.role !== 'WORKER') { router.replace(user.role === 'ADMIN' ? '/admin' : '/chat'); return; }
    refresh(); dispatch(fetchProfile());
    const timer = window.setInterval(() => { refresh(); setNow(Date.now()); }, 20000);
    const focus = () => { refresh(); };
    window.addEventListener('focus', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [token, user?.id, user?.role, router, refresh, dispatch]);
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const tracking = user?.role === 'WORKER' && workerRequests.some(r => r.workerId === user.workerProfile?.id && ['ACCEPTED', 'IN_PROGRESS'].includes(r.status) && r.bookingStage !== 'READY' && (!r.scheduledAt || new Date(r.scheduledAt).getTime() <= now + 3600000));
  const { position, error: locationError } = useLivePosition(tracking);
  if (!user || user.role !== 'WORKER') return <div role="status" className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Opening professional workspace...</div>;
  return <Context.Provider value={{ user, requests: workerRequests, loading, error, stats, position, locationError, refresh }}><div className="portal-professional min-h-screen bg-[var(--page)] text-[var(--text)]">
    {menu && <button aria-label="Close navigation" onClick={() => setMenu(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
    <aside aria-label="Professional navigation" className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--panel)] p-4 transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex min-h-10 items-center justify-between"><Brand href="/worker" /><button aria-label="Close navigation" onClick={() => setMenu(false)} className="grid h-11 w-11 place-items-center lg:hidden"><X size={20} /></button></div>
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Professional workspace</p>
      <nav className="space-y-1">{navigation.map(({ href, label, Icon }) => { const active = href === '/worker' ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? 'bg-blue-500/10 text-[var(--brand)]' : 'text-[var(--muted)] hover:bg-[var(--soft)]'}`}><Icon size={19} />{label}</Link>; })}</nav>
      <div className="mt-auto border-t border-[var(--border)] pt-4"><p className="truncate px-3 text-sm font-semibold">{user.name}</p><p className="mb-3 mt-1 truncate px-3 text-xs text-[var(--muted)]">{user.email}</p><LogoutButton className="w-full" /></div>
    </aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2 sm:px-7"><div className="flex min-w-0 items-center gap-2"><button aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[var(--soft)] lg:hidden"><Menu size={20} /></button><p className="truncate text-sm font-semibold">{navigation.find(n => n.href !== '/worker' && pathname.startsWith(n.href))?.label || 'Overview'}</p></div><div className="flex items-center gap-2"><button disabled={toggling} onClick={async () => { setToggling(true); try { const result = await workerAPI.toggleAvailability(); dispatch(updateUser({ workerProfile: { ...user.workerProfile!, isAvailable: result.data.data.isAvailable } })); } catch (error) { notify({ title: 'Could not change availability', message: getApiError(error, 'Try again.') }); } finally { setToggling(false); } }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"><span className={`h-2 w-2 rounded-full ${user.workerProfile?.isAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`} />{user.workerProfile?.isAvailable ? 'Available' : 'Offline'}</button><WorkspaceTools /></div></header>
      <main className="mx-auto max-w-6xl px-4 py-7 pb-24 sm:px-7 sm:py-9">{children}</main>
    </div>
  </div></Context.Provider>;
}
