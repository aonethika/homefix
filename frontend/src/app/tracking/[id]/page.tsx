'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import type { RootState } from '@/store';
import { requestAPI, getApiError } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { useLivePosition } from '@/hooks/useLivePosition';
import RequestTracker from '@/components/RequestTracker';
import CancelRequestButton from '@/components/CancelRequestButton';
import SafetyShortcuts from '@/components/SafetyShortcuts';
import WorkspaceTools from '@/components/WorkspaceTools';
import StatusBadge from '@/components/StatusBadge';
export default function TrackingPage({ params }: { params: { id: string } }) {
  const { user, token } = useSelector((s: RootState) => s.auth); const router = useRouter();
  const [request, setRequest] = useState<any>(null); const [error, setError] = useState('');
  useSocket(token, user?.role);
  const refresh = async () => { try { setRequest((await requestAPI.details(params.id)).data.data); setError(''); } catch (error) { setError(getApiError(error, 'Could not load this visit.')); } };
  useEffect(() => { if (!user || !token) { router.replace('/login'); return; } refresh(); const timer = window.setInterval(refresh, 10000); return () => clearInterval(timer); }, [params.id, user?.id, token, router]);
  const professional = user?.role === 'WORKER';
  const sharing = professional && request && ['ACCEPTED', 'IN_PROGRESS'].includes(request.status) && request.bookingStage !== 'READY' && (!request.scheduledAt || new Date(request.scheduledAt).getTime() <= Date.now() + 3600000);
  const { position, error: locationError } = useLivePosition(Boolean(sharing));
  const back = professional ? `/worker/jobs/${params.id}` : '/dashboard';
  return <div className="min-h-screen bg-[var(--page)] text-[var(--text)]"><header className="relative z-30 flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2 sm:px-8"><Link href={back} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={17} />{professional ? 'Back to job' : 'My bookings'}</Link><WorkspaceTools /></header><main className="mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-8"><div><h1 className="text-2xl font-bold">Track your visit</h1><p className="mt-2 text-sm text-[var(--muted)]">Live location and route information, here in Zoon.</p></div>{error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{request ? <><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{professional ? request.user?.name : request.worker?.user?.name}</h2><StatusBadge status={request.status} /></div><RequestTracker request={request} position={position} professional={professional} locationError={locationError} /><div className="flex flex-wrap gap-2"><CancelRequestButton request={request} onCancelled={refresh} onChanged={refresh} />{request.sessionId && <Link href={request.bookingStage ? `/bookings/${request.id}` : professional ? `/worker/jobs/${request.id}` : `/chat?sessionId=${request.sessionId}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold"><MessageCircle size={16} />Open conversation</Link>}</div>{!['CANCELLED', 'REJECTED', 'PAID'].includes(request.status) && <SafetyShortcuts />}</> : !error && <div role="status" className="h-72 rounded-2xl shimmer" />}</main></div>;
}
