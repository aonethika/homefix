'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, MapPin, MessageCircle, Plus, Search, Star, Wallet } from 'lucide-react';
import { AppDispatch, RootState } from '@/store';
import { fetchUserRequests } from '@/store/requestSlice';
import { formatCurrency, formatDate, SERVICE_LABELS } from '@/utils/formatTime';
import Brand from '@/components/Brand';
import WorkspaceTools from '@/components/WorkspaceTools';
import LogoutButton from '@/components/LogoutButton';
import StatusBadge from '@/components/StatusBadge';
import ServiceIcon from '@/components/ServiceIcon';
import CancelRequestButton from '@/components/CancelRequestButton';

const closed = (request: any) => ['PAID', 'CANCELLED', 'REJECTED'].includes(request.status) || request.payment?.status === 'PAID';
export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);
  const { requests, loading, error } = useSelector((s: RootState) => s.request);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return; }
    if (user.role !== 'USER') { router.replace(user.role === 'WORKER' ? '/worker' : '/admin'); return; }
    dispatch(fetchUserRequests());
    const timer = window.setInterval(() => dispatch(fetchUserRequests()), 20000);
    return () => clearInterval(timer);
  }, [token, user?.id, user?.role, dispatch, router]);
  if (!user || user.role !== 'USER') return null;
  const active = requests.filter(r => !closed(r));
  const upcoming = active.filter(r => r.scheduledAt && new Date(r.scheduledAt) > new Date());
  const shown = requests.filter(r => (filter === 'All' || filter === 'Active' && !closed(r) || filter === 'Upcoming' && upcoming.includes(r) || filter === 'History' && closed(r)) && `${r.serviceKey || r.serviceType} ${r.description} ${r.worker?.user?.name || ''}`.toLowerCase().includes(query.toLowerCase()));
  const refresh = async () => { await dispatch(fetchUserRequests()); };
  return <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2 sm:px-8"><Brand /><div className="flex items-center gap-1"><Link href="/chat" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] sm:flex"><MessageCircle size={17} />FixBot</Link><LogoutButton className="hidden sm:inline-flex" /><WorkspaceTools /></div></header>
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)]">Your home, taken care of</p><h1 className="mt-2 text-3xl font-bold tracking-tight">My bookings</h1><p className="mt-2 text-sm text-[var(--muted)]">Welcome back, {user.name.split(' ')[0]}. Keep track of every visit in one place.</p></div><Link href="/workers" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={18} />Book a service</Link></div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Active requests', value: active.length, Icon: ClipboardList },
        { label: 'Upcoming visits', value: upcoming.length, Icon: CalendarDays },
        { label: 'Completed jobs', value: requests.filter(r => ['COMPLETED', 'PAID'].includes(r.status) || r.payment?.status === 'PAID').length, Icon: CheckCircle2 },
        { label: 'Total paid', value: formatCurrency(requests.filter(r => r.payment?.status === 'PAID').reduce((sum, r) => sum + Number(r.finalPrice || 0), 0)), Icon: Wallet },
      ].map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"><Icon size={20} className="mb-4 text-[var(--brand)]" /><p className="break-words text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></div>)}</div>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--soft)] p-1" aria-label="Filter bookings">{['All', 'Active', 'Upcoming', 'History'].map(label => <button key={label} onClick={() => setFilter(label)} aria-pressed={filter === label} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${filter === label ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'}`}>{label}</button>)}</div><div className="relative"><Search size={17} className="absolute left-3 top-3.5 text-[var(--muted)]" /><input aria-label="Search bookings" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search service or professional" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] pl-10 pr-3 text-sm sm:w-72" /></div></div>
      {error && <p role="alert" className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      {loading && !requests.length ? <div className="grid gap-4 md:grid-cols-2">{[1, 2].map(i => <div key={i} className="h-64 rounded-2xl shimmer" />)}</div> : !shown.length ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] px-6 py-16 text-center"><ClipboardList size={32} className="mx-auto text-[var(--muted)]" /><h2 className="mt-4 text-lg font-semibold">{requests.length ? 'No matching bookings' : 'Your first service starts here'}</h2><p className="mt-2 text-sm text-[var(--muted)]">{requests.length ? 'Try another filter or search term.' : 'Describe what needs fixing or choose a professional.'}</p>{!requests.length && <Link href="/chat" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">Start a conversation<ArrowUpRight size={16} /></Link>}</div> : <div className="grid gap-4 md:grid-cols-2">{shown.map(request => {
        const service = request.serviceKey || request.serviceType;
        const conversation = request.bookingStage ? `/bookings/${request.id}` : request.sessionId ? `/chat?sessionId=${request.sessionId}` : null;
        return <article key={request.id} className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 transition hover:shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-[var(--brand)]"><ServiceIcon service={service} /></span><div><h2 className="text-base font-semibold">{SERVICE_LABELS[service] || String(service || 'Home service').replaceAll('_', ' ')}</h2><p className="mt-1 text-xs text-[var(--muted)]">Requested {formatDate(request.createdAt)}</p></div></div><StatusBadge status={request.status} /></div>
          <p className="mb-5 mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{request.description}</p>
          <div className="mb-5 space-y-3 text-sm"><p className="flex items-center gap-2"><Clock3 size={16} className="shrink-0 text-[var(--muted)]" />{request.scheduledAt ? new Date(request.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'On-demand service'}</p>{request.userAddress && <p className="flex items-start gap-2 text-[var(--muted)]"><MapPin size={16} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{request.userAddress}</span></p>}</div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-4 text-sm"><span className="font-semibold">{request.worker?.user?.name || 'Finding your professional'}</span>{request.finalPrice != null && <span className="font-semibold">{formatCurrency(request.finalPrice)}</span>}{request.rating && <span className="inline-flex items-center gap-1 text-xs text-[var(--warning)]"><Star size={13} />{request.rating.score}/5</span>}</div>
          <div className="flex flex-wrap gap-2">{conversation && <Link href={conversation} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--soft)] px-4 text-sm font-semibold"><MessageCircle size={16} />Open conversation</Link>}{['ACCEPTED', 'IN_PROGRESS'].includes(request.status) && <Link href={`/tracking/${request.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--brand)]"><MapPin size={16} />Track visit</Link>}<CancelRequestButton request={request} onCancelled={refresh} onChanged={refresh} /></div>
        </article>;
      })}</div>}
    </main>
  </div>;
}
