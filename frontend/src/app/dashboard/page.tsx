'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { fetchUserRequests } from '@/store/requestSlice';
import { logout } from '@/store/authSlice';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import {
  formatDate,
  formatCurrency,
  SERVICE_EMOJIS,
  SERVICE_LABELS,
} from '@/utils/formatTime';

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);
  const { requests, loading } = useSelector((s: RootState) => s.request);

  useEffect(() => {
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'USER') {
      router.replace(user.role === 'WORKER' ? '/worker' : '/admin');
      return;
    }
    dispatch(fetchUserRequests());
  }, [token, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-[#18181b]/80 backdrop-blur border-b border-[#2a2a30] px-4 sm:px-6 py-3 flex items-center justify-between">
        
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/chat" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-sm">
              🏠
            </div>
            <span className="font-semibold text-sm hidden sm:block">HomeFix</span>
          </Link>

          <span className="text-[#2a2a30] hidden sm:block">/</span>
          <span className="text-xs sm:text-sm text-[#a8a29e]">My Requests</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/chat"
            className="text-xs px-3 py-1.5 bg-[#418e4d]/10 hover:bg-[#418e4d]/20 text-[#6ee7b7] border border-[#418e4d]/20 rounded-lg transition"
          >
            + New
          </Link>

          <button
            onClick={() => {
              dispatch(logout());
              router.push('/login');
            }}
            className="text-xs text-[#57534e] hover:text-[#a8a29e]"
          >
            Logout
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">

        {/* USER */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#418e4d]/10 border border-[#418e4d]/20 flex items-center justify-center font-bold text-[#6ee7b7]">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">{user.name}</h1>
            <p className="text-xs sm:text-sm text-[#a8a29e]">{user.email}</p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 sm:mb-8">
          {[
            {
              label: 'Total Requests',
              value: requests.length,
              icon: '📋',
            },
            {
              label: 'Completed',
              value: requests.filter(r => r.status === 'COMPLETED').length,
              icon: '✅',
            },
            {
              label: 'Total Spent',
              value: formatCurrency(
                requests
                  .filter(r => r.payment?.status === 'PAID')
                  .reduce((s: number, r: any) => s + (r.finalPrice || 0), 0)
              ),
              icon: '💰',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-[#18181b] border border-[#2a2a30] rounded-xl p-4 text-center"
            >
              <div className="text-xl mb-1">{stat.icon}</div>
              <p className="text-lg font-semibold">{stat.value}</p>
              <p className="text-[10px] text-[#57534e] uppercase tracking-wide">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* TITLE */}
        <h2 className="text-xs sm:text-sm font-semibold text-[#a8a29e] uppercase tracking-widest mb-4">
          Service History
        </h2>

        {/* STATES */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 shimmer rounded-xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🏠</div>
            <p className="text-[#a8a29e] mb-2">No requests yet</p>
            <p className="text-sm text-[#57534e] mb-6">
              Start a chat to book your first service
            </p>
            <Link
              href="/chat"
              className="px-5 py-2.5 bg-[#418e4d] hover:bg-[#357a41] text-white text-sm font-semibold rounded-xl transition"
            >
              Start Chat
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <div
                key={req.id}
                className="bg-[#18181b] border border-[#2a2a30] hover:border-[#418e4d]/30 rounded-xl p-4 sm:p-5 transition"
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2a2a30] flex items-center justify-center text-lg">
                      {SERVICE_EMOJIS[req.serviceType] || '🔧'}
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        {SERVICE_LABELS[req.serviceType]}
                      </p>
                      <p className="text-xs text-[#57534e]">
                        {formatDate(req.createdAt)}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={req.status} />
                </div>

                <p className="text-xs text-[#a8a29e] mb-3 line-clamp-2">
                  {req.description}
                </p>

                <div className="flex flex-wrap justify-between items-center gap-2">
                  
                  <div className="flex flex-wrap gap-3 text-xs text-[#57534e]">
                    {req.worker && (
                      <span>👷 {req.worker.user.name}</span>
                    )}
                    {req.finalPrice && (
                      <span className="text-[#6ee7b7] font-semibold">
                        {formatCurrency(req.finalPrice)}
                      </span>
                    )}
                  </div>

                  {req.rating && (
                    <div className="text-yellow-400 text-xs">
                      {'⭐'.repeat(req.rating.score)}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}