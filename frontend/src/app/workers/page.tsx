'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { workerAPI } from '@/services/api';
import WorkerCard from '@/components/WorkerCard';
import { SERVICE_LABELS } from '@/utils/formatTime';

const SERVICE_TYPES = ['', 'PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'];

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (filter) params.serviceType = filter;
        const { data } = await workerAPI.getAll(params);
        setWorkers(data.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, [filter]);

  return (
    <div className="min-h-screen bg-[#0f0f10]">

      <nav className="border-b border-[#2a2a30] px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-sm">🏠</div>
          <span className="font-bold text-white text-sm">HomeFix</span>
        </Link>

        <Link
          href="/chat"
          className="text-[11px] px-3 py-1.5 bg-[#418e4d]/10 border border-[#418e4d]/20 text-[#6ee7b7] rounded-lg"
        >
          Book →
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          Professionals
        </h1>
        <p className="text-xs sm:text-sm text-[#a8a29e] mb-5">
          Verified workers near you
        </p>

        <div className="flex gap-2 flex-wrap mb-5">
          {SERVICE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-[11px] rounded-lg border ${
                filter === type
                  ? 'bg-[#418e4d]/15 border-[#418e4d]/30 text-[#6ee7b7]'
                  : 'bg-[#18181b] border-[#2a2a30] text-[#57534e]'
              }`}
            >
              {type ? SERVICE_LABELS[type] : 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[#18181b] border border-[#2a2a30] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-[#a8a29e] text-sm">No workers found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workers.map((w: any) => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}