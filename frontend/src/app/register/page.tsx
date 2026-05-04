'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '@/store/authSlice';
import { RootState, AppDispatch } from '@/store';

const SERVICE_TYPES = ['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'];

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error, user } = useSelector((s: RootState) => s.auth);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    role: 'USER', serviceType: 'PLUMBER',
    address: '', latitude: '', longitude: '',
  });
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (user) router.replace(user.role === 'WORKER' ? '/worker' : '/chat');
  }, [user, router]);

  useEffect(() => { dispatch(clearError()); }, []);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name, email: form.email, password: form.password,
      phone: form.phone, role: form.role, address: form.address,
    };
    if (form.latitude) payload.latitude = parseFloat(form.latitude);
    if (form.longitude) payload.longitude = parseFloat(form.longitude);
    if (form.role === 'WORKER') payload.serviceType = form.serviceType;
    await dispatch(register(payload));
  };

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      set('latitude', pos.coords.latitude.toString());
      set('longitude', pos.coords.longitude.toString());
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-orange-500/30">🏠</div>
            <span className="font-display font-bold text-xl text-white">HomeFix</span>
          </Link>
          <h1 className="text-2xl font-display font-bold text-white">Create account</h1>
          <p className="text-sm text-[#a8a29e] mt-1">Join HomeFix today</p>
        </div>

        {/* Role toggle */}
        <div className="flex bg-[#18181b] border border-[#2a2a30] rounded-xl p-1 mb-6">
          {['USER', 'WORKER'].map(r => (
            <button key={r} onClick={() => set('role', r)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${form.role === r ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'text-[#a8a29e] hover:text-white'}`}>
              {r === 'USER' ? '👤 Homeowner' : '🔧 Professional'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Full Name</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Email</label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Password</label>
              <input required type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Phone (optional)</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>

            {form.role === 'WORKER' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Service Type</label>
                <select value={form.serviceType} onChange={e => set('serviceType', e.target.value)}
                  className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors">
                  {SERVICE_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Address (optional)</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Your area / city"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Latitude</label>
              <input value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="11.258"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">Longitude</label>
              <input value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="75.780"
                className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-orange-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#57534e] focus:outline-none transition-colors" />
            </div>

            <button type="button" onClick={getLocation}
              className="col-span-2 py-2 text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 rounded-xl transition-colors font-medium">
              📍 Use My Current Location
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Creating...</span></> : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#57534e] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
