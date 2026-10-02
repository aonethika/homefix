'use client';

import { useState } from 'react';
import { ratingAPI } from '@/services/api';

export default function ProfessionalChoice({ worker, onSelect }: { worker: any; onSelect?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const showProfile = async () => {
    setOpen(!open);
    if (reviews) return;
    setError('');
    try { const response = await ratingAPI.getWorkerRatings(worker.id); setReviews(response.data.data); }
    catch { setError('Reviews could not load. Close and reopen to retry.'); }
  };
  return <article className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-[var(--text)]">
    <div className="flex items-center justify-between gap-3"><b>{worker.name}</b><span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">zoon approved</span></div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">{worker.faceVerified && <span className="rounded-full bg-teal-500/10 px-3 py-1 text-teal-600">Face photo checks passed</span>}{worker.panVerified && <span className="rounded-full bg-teal-500/10 px-3 py-1 text-teal-600">PAN record checked</span>}</div>
    <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">Approval and identity checks do not guarantee work quality or personal safety. Review their experience and customer feedback.</p>
    <p className="mt-2 text-xs leading-5">{worker.bio || 'zoon service professional'}</p>
    {typeof worker.isAvailable === 'boolean' && <p className="mt-2 text-xs text-[var(--muted)]">{worker.isAvailable ? 'Available for immediate requests' : 'Offline for immediate requests'}</p>}
    <p className="mt-2 text-xs text-[var(--muted)]">★ {Number(worker.rating || 0).toFixed(1)} · {worker.reviewCount ?? worker._count?.ratingsReceived ?? 0} reviews · {worker.totalJobs || 0} completed jobs{worker.distance != null ? ` · ${Number(worker.distance).toFixed(1)} km straight-line distance` : ''}</p>
    <button onClick={showProfile} aria-expanded={open} className="mt-3 text-xs font-bold text-blue-500">{open ? 'Hide profile and reviews' : 'View profile and reviews'}</button>
    {open && <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3 text-xs">
      <p>{worker.services?.length ? worker.services.map((s: any) => s.category?.name).filter(Boolean).join(' ? ') : String(worker.serviceKey || '').replaceAll('_', ' ')}</p>
      {error ? <p role="alert">{error}</p> : reviews === null ? <p>Loading reviews...</p> : reviews.length === 0 ? <p>No customer reviews yet.</p> : <>
        <p className="font-bold">★ {(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(1)} · {reviews.length} customer reviews</p>
        <div className="max-h-64 space-y-3 overflow-y-auto">{reviews.map(review => <blockquote key={review.id} className="rounded-lg bg-[var(--soft)] p-3"><b>{review.rater?.name || 'Customer'} · {review.score}/5</b><p className="mt-1">{review.comment || 'No written review.'}</p></blockquote>)}</div>
      </>}
    </div>}
    {onSelect && <button onClick={onSelect} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Request {worker.name}</button>}
  </article>;
}
