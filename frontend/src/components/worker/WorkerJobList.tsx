'use client';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ClipboardList, MapPin } from 'lucide-react';
import { useWorkerWorkspace } from './WorkerWorkspace';
import ServiceIcon from '../ServiceIcon';
import StatusBadge from '../StatusBadge';
import { formatDate, SERVICE_LABELS } from '@/utils/formatTime';
export type JobView = 'requests' | 'jobs' | 'appointments' | 'history';
export function jobMatches(request: any, view: JobView) {
  const closed = ['CANCELLED', 'REJECTED', 'PAID'].includes(request.status) || request.payment?.status === 'PAID';
  if (view === 'history') return closed;
  if (closed) return false;
  if (view === 'appointments') return Boolean(request.scheduledAt || request.bookingStage);
  if (view === 'requests') return !request.scheduledAt && !request.bookingStage && ['SEARCHING', 'ASSIGNED'].includes(request.status);
  return !['PENDING', 'SEARCHING', 'ASSIGNED'].includes(request.status) && (!request.scheduledAt || new Date(request.scheduledAt) <= new Date()) && request.bookingStage !== 'READY';
}
export default function WorkerJobList({ view }: { view: JobView }) {
  const { requests, loading, error } = useWorkerWorkspace();
  const items = requests.filter(r => jobMatches(r, view));
  const title = { requests: 'New requests', jobs: 'Active jobs', appointments: 'Appointments', history: 'Job history' }[view];
  return <><div className="mb-7"><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-[var(--muted)]">{view === 'requests' ? 'Review the issue before you accept a new job.' : view === 'appointments' ? 'Keep upcoming visits, times and conversations organized.' : view === 'jobs' ? 'Open a job to track the route, message the customer or update progress.' : 'Your past work and closed requests.'}</p></div>
    {error && <p role="alert" className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
    {loading && !requests.length ? <div className="h-60 rounded-2xl shimmer" /> : !items.length ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-12 text-center"><ClipboardList className="mx-auto text-[var(--muted)]" size={30} /><h2 className="mt-4 font-semibold">No {title.toLowerCase()} right now</h2><p className="mt-2 text-sm text-[var(--muted)]">New updates will appear here automatically.</p></div> : <div className="grid gap-4 xl:grid-cols-2">{items.map(request => <article key={request.id} className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/10 text-[var(--brand)]"><ServiceIcon service={request.serviceKey || request.serviceType} /></span><div><h2 className="font-semibold">{request.user?.name || 'Homeowner'}</h2><p className="mt-1 text-xs text-[var(--muted)]">{SERVICE_LABELS[request.serviceKey || request.serviceType] || 'Home service'}</p></div></div><StatusBadge status={request.status} /></div><p className="my-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{request.description}</p>{request.scheduledAt && <p className="mb-3 flex items-center gap-2 text-sm"><CalendarDays size={16} className="text-[var(--brand)]" />{new Date(request.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}<p className="mb-5 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><MapPin size={15} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{request.userAddress || 'Address shared in conversation'}</span></p><div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4"><time className="text-xs text-[var(--muted)]">{formatDate(request.createdAt)}</time><Link href={`/worker/jobs/${request.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--soft)] px-4 text-sm font-semibold text-[var(--brand)]">Open job<ArrowUpRight size={16} /></Link></div></article>)}</div>}
  </>;
}
