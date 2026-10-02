'use client';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ClipboardList, Star, Wallet, Wrench } from 'lucide-react';
import { useWorkerWorkspace } from '@/components/worker/WorkerWorkspace';
import { jobMatches } from '@/components/worker/WorkerJobList';
import { formatCurrency } from '@/utils/formatTime';
export default function WorkerOverview() {
  const { user, requests, stats } = useWorkerWorkspace();
  const pending = requests.filter(r => jobMatches(r, 'requests'));
  const active = requests.filter(r => jobMatches(r, 'jobs'));
  const upcoming = requests.filter(r => jobMatches(r, 'appointments')).sort((a, b) => new Date(a.scheduledAt || a.createdAt).getTime() - new Date(b.scheduledAt || b.createdAt).getTime());
  return <><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)]">Your working day</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1><p className="mt-2 text-sm text-[var(--muted)]">A clear view of your requests, visits and earnings.</p></div>
    {user.workerProfile?.applicationStatus !== 'APPROVED' && <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><h2 className="font-semibold">Your profile is {user.workerProfile?.applicationStatus === 'REJECTED' ? 'awaiting changes' : 'under review'}</h2><p className="mt-2 text-sm text-[var(--muted)]">{user.workerProfile?.applicationNote || 'We will notify you when your application review is complete.'}</p><Link href="/worker/profile" className="mt-3 inline-block text-sm font-semibold text-[var(--brand)]">View profile status</Link></div>}
    <div className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: 'New requests', value: pending.length, Icon: ClipboardList, href: '/worker/requests' },
      { label: 'Active jobs', value: active.length, Icon: Wrench, href: '/worker/jobs' },
      { label: 'Total earnings', value: formatCurrency(stats?.totalEarnings || 0), Icon: Wallet, href: '/worker/history' },
      { label: 'Customer rating', value: stats?.avgRating ? Number(stats.avgRating).toFixed(1) : 'No reviews yet', Icon: Star, href: '/worker/profile' },
    ].map(({ label, value, Icon, href }) => <Link key={label} href={href} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-blue-400 sm:p-5"><Icon size={20} className="mb-4 text-[var(--brand)]" /><p className="break-words text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></Link>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]"><section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-semibold">Next appointments</h2><Link href="/worker/appointments" className="text-xs font-semibold text-[var(--brand)]">View all</Link></div>{!upcoming.length ? <div className="py-8 text-center"><CalendarDays className="mx-auto mb-3 text-[var(--muted)]" size={28} /><p className="text-sm text-[var(--muted)]">No upcoming appointments</p></div> : <div className="divide-y divide-[var(--border)]">{upcoming.slice(0, 4).map(r => <Link key={r.id} href={`/worker/jobs/${r.id}`} className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-semibold">{r.user?.name || 'Homeowner'}</p><p className="mt-1 text-xs text-[var(--muted)]">{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Waiting for visit time'}</p></div><ArrowUpRight size={17} className="text-[var(--brand)]" /></Link>)}</div>}</section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><h2 className="mb-5 font-semibold">Continue your work</h2><div className="space-y-3">{[{ href: '/worker/requests', title: 'Review new requests', text: 'See the issue and decide whether the job is right for you.' }, { href: '/worker/jobs', title: 'Open active jobs', text: 'Track the route, message customers and update progress.' }, { href: '/worker/profile', title: 'Keep your profile up to date', text: 'Manage your bio, contact details and public visibility.' }].map(item => <Link key={item.href} href={item.href} className="block rounded-xl bg-[var(--soft)] p-4"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.text}</p></Link>)}</div></section></div>
  </>;
}
