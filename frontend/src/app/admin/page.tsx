'use client';

import LogoutButton from '@/components/LogoutButton';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BadgeCheck, BriefcaseBusiness, ClipboardList, IndianRupee, Layers3, LogOut, RefreshCw, Search, Star, Users } from 'lucide-react';
import Link from 'next/link';
import ProfessionalKycReview from '@/components/ProfessionalKycReview';
import Brand from '@/components/Brand';
import StatusBadge from '@/components/StatusBadge';
import { adminAPI, authAPI, getApiError } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { formatCurrency, formatDate } from '@/utils/formatTime';

const tabs = [
  ['orders', 'Orders', ClipboardList],
  ['appointments', 'Appointments', ClipboardList],
  ['users', 'Homeowners', Users],
  ['professionals', 'Professionals', BriefcaseBusiness],
  ['categories', 'Service categories', Layers3],
  ['complaints', 'Complaints', AlertTriangle],
  ['ratings', 'Ratings & feedback', Star],
] as const;

type Tab = (typeof tabs)[number][0];

const emptyData = { users: [], workers: [], requests: [], complaints: [], ratings: [], categories: [], appRatings: [] };

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [credentials, setCredentials] = useState({ email: 'admin@example.com', password: '' });
  const [data, setData] = useState<any>(emptyData);
  const [tab, setTab] = useState<Tab>('orders');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [operationError, setOperationError] = useState('');
  const [reviewing, setReviewing] = useState<any>(null);

  useSocket(adminToken, 'ADMIN');

  const load = useCallback(async () => {
    setLoading(true);
    setOperationError('');
    try {
      const response = await adminAPI.getOverview();
      setData(response.data.data);
    } catch (error) {
      setOperationError(getApiError(error, 'Could not load administration data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem('zoon_admin_token');
      const stored = localStorage.getItem('zoon_admin_user');
      const user = stored ? JSON.parse(stored) : null;
      if (token && user?.role === 'ADMIN') {
        setAdminToken(token);
        setAdminUser(user);
      } else {
        localStorage.removeItem('zoon_admin_token');
        localStorage.removeItem('zoon_admin_user');
      }
    } catch {
      localStorage.removeItem('zoon_admin_token');
      localStorage.removeItem('zoon_admin_user');
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => { if (authReady && adminToken && adminUser?.role === 'ADMIN') load(); }, [authReady, adminToken, adminUser, load]);
  useEffect(() => { if (!adminToken) return; window.addEventListener('zoon:data-changed', load); return () => window.removeEventListener('zoon:data-changed', load); }, [adminToken, load]);

  const stats = useMemo(() => ({
    users: data.users.filter((item: any) => item.role === 'USER').length,
    professionals: data.workers.length,
    active: data.requests.filter((item: any) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'].includes(item.status)).length,
    revenue: data.requests.filter((item: any) => item.payment?.status === 'PAID').reduce((sum: number, item: any) => sum + (item.finalPrice || 0), 0),
    pendingCategories: data.categories.filter((item: any) => item.status === 'PENDING').length,
    complaints: data.complaints.filter((item: any) => !['RESOLVED', 'DISMISSED'].includes(item.status)).length,
  }), [data]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await authAPI.login({ ...credentials, portal: 'ADMIN' });
      const result = response.data.data;
      if (result.user?.role !== 'ADMIN') throw new Error('This account does not have admin access.');
      localStorage.setItem('zoon_admin_token', result.token);
      localStorage.setItem('zoon_admin_user', JSON.stringify(result.user));
      setAdminToken(result.token);
      setAdminUser(result.user);
    } catch (error: any) {
      setAuthError(getApiError(error, error.message || 'Admin sign in failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('zoon_admin_token');
    localStorage.removeItem('zoon_admin_user');
    setAdminToken(null);
    setAdminUser(null);
    setData(emptyData);
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setOperationError('');
    try { await action(); await load(); }
    catch (error) { setOperationError(getApiError(error, 'The action could not be completed.')); }
  };

  if (!authReady) return <main className="hf-page grid min-h-screen place-items-center"><RefreshCw className="animate-spin text-blue-600" /></main>;
  if (!adminUser || !adminToken) return <main className="hf-page grid min-h-screen place-items-center p-4"><form onSubmit={signIn} className="hf-panel w-full max-w-md rounded-[2rem] p-8"><Brand /><p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-teal-600">Restricted administration</p><h1 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-[var(--text)]">Admin sign in</h1><p className="mt-2 text-sm text-[var(--muted)]">A separate workspace for platform operations and quality control.</p><p className="mt-3 text-xs text-[var(--muted)]"><Link href="/login" className="text-[var(--brand)]">Homeowner sign in</Link> / <Link href="/professional-login" className="text-[var(--brand)]">Professional sign in</Link></p><div className="mt-7 space-y-4"><input required type="email" className="hf-input" value={credentials.email} onChange={event => setCredentials({ ...credentials, email: event.target.value })} placeholder="Admin email" /><input required type="password" className="hf-input" value={credentials.password} onChange={event => setCredentials({ ...credentials, password: event.target.value })} placeholder="Admin password" />{authError && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{authError}</p>}<button disabled={authLoading} className="hf-primary w-full px-4 py-3.5">{authLoading ? 'Signing in…' : 'Enter admin panel'}</button></div></form></main>;

  const includes = (...values: any[]) => !query || values.some(value => String(value || '').toLowerCase().includes(query.toLowerCase()));
  const reviewCategory = (id: string, status: 'APPROVED' | 'REJECTED') => runAction(() => adminAPI.reviewCategory(id, status));


  return <main className="hf-page min-h-screen lg:flex">
    <aside className="border-b border-[var(--border)] bg-[var(--panel)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex h-16 items-center justify-between px-5 lg:h-20"><Brand /><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Admin</span></div>
      <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4 lg:py-4">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition lg:w-full ${tab === key ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg' : 'text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]'}`}><Icon size={17} /><span className="lg:flex-1">{label}</span>{key === 'categories' && stats.pendingCategories > 0 && <b className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{stats.pendingCategories}</b>}{key === 'complaints' && stats.complaints > 0 && <b className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{stats.complaints}</b>}</button>)}</nav>
      <div className="hidden border-t border-[var(--border)] p-4 lg:block"><div className="rounded-2xl bg-[var(--soft)] p-3"><p className="truncate text-xs font-bold text-[var(--text)]">{adminUser.name}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{adminUser.email}</p></div><LogoutButton onConfirmed={signOut} /></div>
    </aside>

    <section className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:var(--panel)]/90 px-4 backdrop-blur-xl sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-600">Operations centre</p><h1 className="font-display text-lg font-bold text-[var(--text)]">{tabs.find(item => item[0] === tab)?.[1]}</h1></div><div className="flex gap-2"><button onClick={load} className="grid h-10 w-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="Refresh"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><LogoutButton onConfirmed={signOut} /></div></header>

      <div className="mx-auto max-w-7xl p-4 sm:p-7">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[
          ['Homeowners', stats.users, Users], ['Professionals', stats.professionals, BadgeCheck], ['Active jobs', stats.active, Activity], ['Revenue', formatCurrency(stats.revenue), IndianRupee], ['Category reviews', stats.pendingCategories, Layers3], ['Open complaints', stats.complaints, AlertTriangle],
        ].map(([label, value, Icon]: any) => <div key={label} className="hf-panel rounded-2xl p-4"><Icon size={17} className="text-blue-500" /><p className="mt-3 text-2xl font-extrabold text-[var(--text)]">{value}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{label}</p></div>)}</div>

        <div className="mt-6 flex items-center gap-3"><div className="relative w-full max-w-xl"><Search size={16} className="absolute left-4 top-4 text-[var(--muted)]" /><input className="hf-input pl-11" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tabs.find(item => item[0] === tab)?.[1].toLowerCase()}…`} /></div><span className="hidden items-center gap-1.5 text-xs text-emerald-600 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live</span></div>
        {operationError && <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{operationError}</div>}

        <section className="mt-5 space-y-3">
          {(tab === 'orders' || tab === 'appointments') && data.requests.filter((item: any) => tab !== 'appointments' || item.scheduledAt || item.bookingStage).sort((a: any, b: any) => tab === 'appointments' ? new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() : 0).filter((item: any) => includes(item.user?.name, item.worker?.user?.name, item.description, item.serviceKey, item.serviceType, item.status)).map((item: any) => <Row key={item.id} title={`${item.serviceKey || item.serviceType || 'Service'} · ${item.user?.name || 'Homeowner'}`} subtitle={`${item.description} · Professional: ${item.worker?.user?.name || 'Not assigned'} · ${item.scheduledAt ? `Appointment ${new Date(item.scheduledAt).toLocaleString()}` : `Created ${formatDate(item.createdAt)}`}`} side={<div className="flex items-center gap-3">{item.finalPrice && <b className="text-sm text-emerald-600">{formatCurrency(item.finalPrice)}</b>}<StatusBadge status={item.status} />{item.bookingStage && <Link className="text-sm text-blue-500" href={`/bookings/${item.id}?admin=1`}>Review {item.bookingStage.toLowerCase()}</Link>}</div>} />)}
          {tab === 'users' && data.users.filter((item: any) => item.role === 'USER' && includes(item.name, item.email, item.phone, item.address)).map((item: any) => <Row key={item.id} title={item.name} subtitle={`${item.email}${item.phone ? ` · ${item.phone}` : ''}${item.address ? ` · ${item.address}` : ''}`} side={<span className="text-xs text-[var(--muted)]">Joined {formatDate(item.createdAt)}</span>} />)}
          {tab === 'professionals' && data.workers.filter((item: any) => includes(item.user?.name, item.user?.email, item.panNumber, item.serviceKey, item.serviceType, item.applicationStatus)).map((item: any) => { const pendingCategory = item.services?.some((service: any) => service.category.status === 'PENDING'); return <Row key={item.id} title={item.user?.name} subtitle={`${item.services?.map((service: any) => service.category.name).join(', ') || item.serviceKey || item.serviceType || 'Unspecified'} · ${item.user?.email} · ${item.isPublic ? 'Public profile' : 'Private profile'} | PAN ${item.panNumber || 'not provided'} · ${Number(item.rating || 0).toFixed(1)} rating · ${item.totalJobs} jobs`} side={<div className="flex flex-wrap items-center gap-2">{<button onClick={() => setReviewing(item)} className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">Review KYC</button>}<span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${item.applicationStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><BadgeCheck size={13} />{item.applicationStatus === 'APPROVED' ? 'Approved' : item.applicationStatus === 'REJECTED' ? 'Changes requested' : pendingCategory ? 'Category pending' : 'Admin review pending'}</span></div>} />; })}
          {tab === 'categories' && data.categories.filter((item: any) => includes(item.name, item.key, item.status, item.requestedBy?.name)).map((item: any) => <Row key={item.id} title={item.name} subtitle={`${item.key} · Requested by ${item.requestedBy?.name || 'zoon'}${item.description ? ` · ${item.description}` : ''}`} side={<div className="flex items-center gap-2">{item.status === 'PENDING' ? <><Action onClick={() => reviewCategory(item.id, 'APPROVED')} approve>Approve category</Action><Action onClick={() => reviewCategory(item.id, 'REJECTED')}>Reject</Action></> : <StatusBadge status={item.status} />}</div>} />)}
          {tab === 'complaints' && data.complaints.filter((item: any) => includes(item.subject, item.message, item.author?.name, item.status)).map((item: any) => <Row key={item.id} title={item.subject} subtitle={`${item.author?.name} (${item.author?.role}) · ${item.message}`} side={<select className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--text)]" value={item.status} onChange={event => runAction(() => adminAPI.updateComplaint(item.id, event.target.value))}>{['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'].map(status => <option key={status}>{status}</option>)}</select>} />)}
          {tab === 'ratings' && data.ratings.filter((item: any) => includes(item.rater?.name, item.worker?.user?.name, item.comment, item.score)).map((item: any) => <Row key={item.id} title={`${'★'.repeat(item.score)}${'☆'.repeat(5 - item.score)}`} subtitle={`${item.rater?.name} rated ${item.worker?.user?.name}${item.comment ? ` · “${item.comment}”` : ''}`} side={<span className="text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</span>} />)}
          {tab === 'ratings' && (data.appRatings || []).filter((item: any) => includes(item.user?.name, item.comment, item.score)).map((item: any) => <Row key={`app-${item.id}`} title={`zoon app · ${'★'.repeat(item.score)}${'☆'.repeat(5 - item.score)}`} subtitle={`${item.user?.name}${item.comment ? ` · “${item.comment}”` : ''}`} side={<span className="text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</span>} />)}
          {!loading && ((tab === 'appointments' && !data.requests.some((item: any) => item.scheduledAt || item.bookingStage)) || (tab === 'orders' && data.requests.length === 0) || (tab === 'users' && data.users.filter((item: any) => item.role === 'USER').length === 0) || (tab === 'professionals' && data.workers.length === 0) || (tab === 'categories' && data.categories.length === 0) || (tab === 'complaints' && data.complaints.length === 0) || (tab === 'ratings' && data.ratings.length === 0 && data.appRatings.length === 0)) && <div className="hf-panel rounded-2xl p-12 text-center text-sm text-[var(--muted)]">Nothing here yet.</div>}
        </section>
      </div>
    </section>
    {reviewing && <ProfessionalKycReview worker={reviewing} onClose={() => setReviewing(null)} onReviewed={load}/>}
  </main>;
}

function Row({ title, subtitle, side }: { title: string; subtitle: string; side: React.ReactNode }) {
  return <div className="hf-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-bold text-[var(--text)]">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{subtitle}</p></div>{side}</div>;
}

function Action({ children, onClick, approve = false }: { children: React.ReactNode; onClick: () => void; approve?: boolean }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${approve ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{children}</button>;
}
