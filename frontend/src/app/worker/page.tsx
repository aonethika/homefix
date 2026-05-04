'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { fetchWorkerRequests } from '@/store/requestSlice';
import { logout, updateUser } from '@/store/authSlice';
import StatusBadge from '@/components/StatusBadge';
import { formatDate, formatCurrency, SERVICE_EMOJIS } from '@/utils/formatTime';
import { workerAPI } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';

export default function WorkerDashboard() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);
  const { workerRequests, loading } = useSelector((s: RootState) => s.request);

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useSocket(token, 'WORKER');

  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return; }
    if (user.role !== 'WORKER') { router.replace('/chat'); return; }
    dispatch(fetchWorkerRequests());
    workerAPI.getStats().then(r => setStats(r.data.data)).catch(() => {});
  }, [token, user]);

  const handleToggleAvailability = async () => {
    try {
      const { data } = await workerAPI.toggleAvailability();
      dispatch(updateUser({
        workerProfile: { ...user!.workerProfile!, isAvailable: data.data.isAvailable }
      }));
    } catch {}
  };

  const handleAction = async (action: string, requestId: string) => {
    setActionLoading(`${action}:${requestId}`);
    try {
      if (action === 'accept') await workerAPI.acceptRequest(requestId);
      if (action === 'reject') await workerAPI.rejectRequest(requestId);
      if (action === 'in_progress') await workerAPI.updateStatus(requestId, 'IN_PROGRESS');
      if (action === 'complete') await workerAPI.updateStatus(requestId, 'COMPLETED');
      if (action === 'price') {
        const price = parseFloat(priceInputs[requestId] || '0');
        if (price > 0) await workerAPI.setPrice(requestId, price);
      }
      dispatch(fetchWorkerRequests());
    } finally {
      setActionLoading(null);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

if (!mounted) return null;

  if (!user) return null;

  const activeRequests = workerRequests.filter((r: any) =>
    ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(r.status)
  );

  const historyRequests = workerRequests.filter((r: any) =>
    ['PAID', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(r.status)
  );

  const isAvailable = user.workerProfile?.isAvailable;

  return (
    <div className="min-h-screen bg-[#0f0f10]">

      <header className="border-b border-[#2a2a30] px-4 py-4 flex items-center justify-between bg-[#18181b] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-sm">🏠</div>
          <span className="font-bold text-white text-sm">HomeFix</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAvailability}
            className={`px-3 py-1 text-[11px] rounded-lg border ${
              isAvailable
                ? 'bg-[#418e4d]/15 border-[#418e4d]/30 text-[#6ee7b7]'
                : 'bg-[#2a2a30] border-[#3a3a40] text-[#57534e]'
            }`}
          >
            {isAvailable ? 'Available' : 'Offline'}
          </button>

          <button
            onClick={() => { dispatch(logout()); router.push('/login'); }}
            className="text-[11px] text-[#57534e]"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        <div className="bg-[#18181b] border border-[#2a2a30] rounded-xl p-4 mb-5 flex gap-3 items-center">
          <div className="w-12 h-12 rounded-xl bg-[#2a2a30] flex items-center justify-center text-xl">
            {SERVICE_EMOJIS[user.workerProfile?.serviceType || ''] || '🔧'}
          </div>

          <div className="flex-1">
            <p className="font-semibold text-white text-sm">{user.name}</p>
            <p className="text-[11px] text-[#a8a29e]">
              {user.workerProfile?.serviceType?.replace('_', ' ')}
            </p>
            <p className="text-[10px] text-[#57534e] mt-1">
              ⭐ {(user.workerProfile?.rating || 0).toFixed(1)} · {user.workerProfile?.totalJobs || 0} jobs
            </p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-[#18181b] border border-[#2a2a30] rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-[#a8a29e]">{stats.stats.pendingJobs}</p>
              <p className="text-[9px] text-[#57534e]">Pending</p>
            </div>
            <div className="bg-[#18181b] border border-[#2a2a30] rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-[#6ee7b7]">{stats.stats.totalJobs}</p>
              <p className="text-[9px] text-[#57534e]">Done</p>
            </div>
            <div className="bg-[#18181b] border border-[#2a2a30] rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-[#6ee7b7]">{formatCurrency(stats.stats.totalEarnings)}</p>
              <p className="text-[9px] text-[#57534e]">Earned</p>
            </div>
          </div>
        )}

        <div className="flex bg-[#18181b] border border-[#2a2a30] rounded-lg p-1 mb-4">
          {(['active', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs rounded-md ${
                activeTab === tab
                  ? 'bg-[#418e4d] text-white'
                  : 'text-[#a8a29e]'
              }`}
            >
              {tab === 'active'
                ? `Active (${activeRequests.length})`
                : `History (${historyRequests.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => (
              <div key={i} className="h-28 bg-[#18181b] border border-[#2a2a30] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(activeTab === 'active' ? activeRequests : historyRequests).map((req: any) => (
              <div key={req.id} className="bg-[#18181b] border border-[#2a2a30] rounded-lg p-4">

                <div className="flex justify-between mb-2">
                  <div>
                    <p className="text-sm text-white">{req.user?.name}</p>
                    <p className="text-[10px] text-[#57534e]">{formatDate(req.createdAt)}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <p className="text-[11px] text-[#a8a29e] mb-3">{req.description}</p>

                {req.status === 'ASSIGNED' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAction('accept', req.id)}
                      className="flex-1 py-2 bg-[#418e4d]/15 text-[#6ee7b7] text-xs rounded-lg">
                      Accept
                    </button>
                    <button onClick={() => handleAction('reject', req.id)}
                      className="flex-1 py-2 bg-red-500/10 text-red-400 text-xs rounded-lg">
                      Reject
                    </button>
                  </div>
                )}

                {req.status === 'ACCEPTED' && (
                  <button onClick={() => handleAction('in_progress', req.id)}
                    className="w-full py-2 bg-[#418e4d]/15 text-[#6ee7b7] text-xs rounded-lg">
                    Start Work
                  </button>
                )}

                {req.status === 'IN_PROGRESS' && (
                  <button onClick={() => handleAction('complete', req.id)}
                    className="w-full py-2 bg-[#418e4d]/15 text-[#6ee7b7] text-xs rounded-lg">
                    Complete
                  </button>
                )}

                {req.status === 'COMPLETED' && !req.proposedPrice && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="₹"
                      value={priceInputs[req.id] || ''}
                      onChange={e => setPriceInputs(p => ({ ...p, [req.id]: e.target.value }))}
                      className="flex-1 bg-[#0f0f10] border border-[#2a2a30] rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <button
                      onClick={() => handleAction('price', req.id)}
                      className="px-3 py-1 bg-[#418e4d]/15 text-[#6ee7b7] text-xs rounded-lg"
                    >
                      Set
                    </button>
                  </div>
                )}

                {req.proposedPrice && (
                  <p className="text-xs text-[#a8a29e] mt-2">
                    Price: <span className="text-[#6ee7b7]">{formatCurrency(req.proposedPrice)}</span>
                  </p>
                )}

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}