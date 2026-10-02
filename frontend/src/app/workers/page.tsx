'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/components/Brand';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { workerAPI, platformAPI } from '@/services/api';
import WorkerCard from '@/components/WorkerCard';
import { SERVICE_LABELS } from '@/utils/formatTime';

const SERVICE_TYPES = ['', 'PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'];

export default function WorkersPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<{key:string;name:string}[]>([]);
  useEffect(() => { platformAPI.getCategories().then(r => setCategories(r.data.data)).catch(() => {}); }, []);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params: any = {};
        if (filter) params.serviceType = filter;
        const { data } = await workerAPI.getAll(params);
        setWorkers(data.data);
      } catch { setError('Could not load professionals. Please refresh to try again.'); }
      setLoading(false);
    };
    load();
  }, [filter]);

  return (
    <div className="hf-page min-h-screen">

      <nav style={{ paddingRight: '5.5rem' }} className="flex-wrap gap-3 border-b border-[var(--border)] px-4 py-4 flex items-center justify-between">
        <Brand />

        {!user && <Link href="/professional-login" className="text-sm text-blue-500">Professional sign in</Link>}
        <Link
          href="/chat"
          className="text-[11px] px-3 py-1.5 bg-[#2563eb]/10 border border-[#2563eb]/20 text-[var(--brand)] rounded-lg"
        >
          Book →
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-1">
          Professionals
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted)] mb-5">
          Browse public profiles of zoon-approved professionals. Identity-check badges appear only when automated checks passed; compare reviews and completed jobs before requesting service.
        </p>

        <div className="flex gap-2 flex-wrap mb-5">
          {['', ...(categories.length ? categories.map(c => c.key) : SERVICE_TYPES.slice(1))].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-[11px] rounded-lg border ${
                filter === type
                  ? 'bg-[#2563eb]/15 border-[#2563eb]/30 text-[var(--brand)]'
                  : 'bg-[var(--panel)] border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {type ? categories.find(c => c.key === type)?.name || SERVICE_LABELS[type] || type : 'All'}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-rose-500">{error}</p>}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-[var(--muted)] text-sm">No workers found</p>
          </div>
        ) : (
          <div className="grid items-start gap-5 md:grid-cols-2">
            {workers.map((w: any) => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}