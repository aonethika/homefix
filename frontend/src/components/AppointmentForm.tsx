'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
export default function AppointmentForm({ worker }: { worker: any }) {
  const user = useSelector((s: RootState) => s.auth.user);
  const next = `/book/${worker.id}`;
  if (user && user.role !== 'USER') return <p className="mt-3 text-xs text-[var(--muted)]">You are viewing the public directory. Bookings require a homeowner account.</p>;
  return <div className="mt-4"><Link className="hf-primary block px-4 py-3 text-center" href={user ? next : `/login?next=${encodeURIComponent(next)}`}>Book this professional</Link><p className="mt-2 text-xs text-[var(--muted)]">Choose a time and send your issue. They confirm the appointment.</p></div>;
}
