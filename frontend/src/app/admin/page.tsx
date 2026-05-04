'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import StatusBadge from '@/components/StatusBadge';
import { formatDate, formatCurrency, SERVICE_EMOJIS, SERVICE_LABELS } from '@/utils/formatTime';
import { requestAPI, workerAPI } from '@/services/api';

export default function AdminDashboard() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);

  const [requests, setRequests] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'workers'>('requests');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return; }
    if (user.role !== 'ADMIN') { router.replace('/chat'); return; }
    loadData();
  }, [token, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, workRes] = await Promise.all([
        requestAPI.getAllRequests(),
        workerAPI.getAll(),
      ]);
      setRequests(reqRes.data.data);
      setWorkers(workRes.data.data);
    } catch {}
    setLoading(false);
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!user) return null;

  const stats = {
    total: requests.length,
    active: requests.filter(r => ['ASSIGNED','ACCEPTED','IN_PROGRESS'].includes(r.status)).length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
    revenue: requests.filter(r => r.payment?.status === 'PAID').reduce((s, r) => s + (r.finalPrice || 0), 0),
    workers: workers.length,
    available: workers.filter((w: any) => w.isAvailable).length,
  };

  const filteredRequests = requests.filter(r =>
    !filter || r.status === filter || r.serviceType === filter
  );

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      <header className="border-b border-[#2a2a30] px-4 sm:px-6 py-4 flex items-center justify-between bg-[#18181b]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-sm">🏠</div>
          <span className="font-bold text-white text-sm">HomeFix</span>
          <span className="text-[#2a2a30] hidden sm:block">/</span>
          <span className="text-sm text-[#6ee7b7] hidden sm:block">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="text-xs text-[#a1a1aa] hover:text-white transition-colors">↻</button>
          <button onClick={() => { dispatch(logout()); router.push('/login'); }} className="text-xs text-[#57534e] hover:text-[#a8a29e] transition-colors">Logout</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Active', value: stats.active, color: 'text-blue-400' },
            { label: 'Done', value: stats.completed, color: 'text-green-400' },
            { label: 'Revenue', value: formatCurrency(stats.revenue), color: 'text-[#6ee7b7]' },
            { label: 'Workers', value: stats.workers, color: 'text-purple-400' },
            { label: 'Online', value: stats.available, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#18181b] border border-[#2a2a30] rounded-xl p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[#57534e] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex bg-[#18181b] border border-[#2a2a30] rounded-xl p-1 mb-5 w-fit">
          {(['requests', 'workers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-lg capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#418e4d] text-white'
                  : 'text-[#a1a1aa]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'requests' && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {['', 'PENDING', 'SEARCHING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg border ${
                    filter === f
                      ? 'bg-[#418e4d]/20 border-[#418e4d]/40 text-[#6ee7b7]'
                      : 'bg-[#18181b] border-[#2a2a30] text-[#57534e]'
                  }`}
                >
                  {f || 'All'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((req: any) => (
                  <div key={req.id} className="bg-[#18181b] border border-[#2a2a30] rounded-xl px-3 py-3 flex items-center gap-3">
                    <span className="text-lg">{SERVICE_EMOJIS[req.serviceType] || '🔧'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{req.user?.name}</p>
                      <p className="text-[11px] text-[#57534e] truncate">{req.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.finalPrice && <span className="text-xs text-green-400">{formatCurrency(req.finalPrice)}</span>}
                      <StatusBadge status={req.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'workers' && (
          <div className="space-y-2">
            {workers.map((w: any) => (
              <div key={w.id} className="bg-[#18181b] border border-[#2a2a30] rounded-xl px-3 py-3 flex items-center gap-3">
                <span className="text-lg">{SERVICE_EMOJIS[w.serviceType] || '🔧'}</span>
                <div className="flex-1">
                  <p className="text-sm text-white">{w.user?.name}</p>
                  <p className="text-[11px] text-[#57534e]">{SERVICE_LABELS[w.serviceType]}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  w.isAvailable ? 'bg-green-500/10 text-green-400' : 'bg-[#2a2a30] text-[#57534e]'
                }`}>
                  {w.isAvailable ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}