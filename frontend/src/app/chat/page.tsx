'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import ChatBox from '@/components/ChatBox';
import Link from 'next/link';

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return; }
    if (user.role === 'WORKER') router.replace('/worker');
    if (user.role === 'ADMIN') router.replace('/admin');
  }, [token, user, router]);

 const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

if (!mounted) return null;
if (!user) return null;
  return (
    <div className="flex flex-col h-screen bg-[#0f0f10]">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-[#2a2a30] px-4 py-3 flex items-center justify-between bg-[#18181b]/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#418e4d] flex items-center justify-center text-sm shadow-lg shadow-green-500/20">🏠</div>
          <span className="font-display font-bold text-white text-sm hidden sm:block">HomeFix</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-[#a8a29e] hover:text-white transition-colors">My Requests</Link>
          <button
            onClick={() => { dispatch(logout()); router.push('/login'); }}
            className="text-xs text-[#57534e] hover:text-[#a8a29e] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Chat fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <ChatBox />
      </div>
    </div>
  );
}
