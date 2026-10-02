'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { restoreSession } from '@/store/authSlice';
import { Provider } from 'react-redux';
import { store } from '@/store';
import NotificationInbox from '@/components/NotificationInbox';
import NotificationToast from '@/components/NotificationToast';
import ThemeToggle from '@/components/ThemeToggle';
import WorkspaceTools from '@/components/WorkspaceTools';
import SupportButton from '@/components/SupportButton';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const token = localStorage.getItem('zoon_token');
      const saved = localStorage.getItem('zoon_user');
      const user = saved ? JSON.parse(saved) : null;
      if (token && user?.id && ['USER', 'WORKER', 'ADMIN'].includes(user.role)) store.dispatch(restoreSession({ user, token }));
      else { localStorage.removeItem('zoon_token'); localStorage.removeItem('zoon_user'); }
    } catch { /* Invalid or unavailable browser storage must not block sign-in. */ }
    setReady(true);
  }, []);
  return <Provider store={store}>{ready ? children : <div role="status" className="grid min-h-screen place-items-center bg-[var(--page)] text-[var(--muted)]">Opening zoon...</div>}<NotificationToast />{pathname !== '/chat' && pathname !== '/dashboard' && pathname !== '/worker' && !pathname.startsWith('/worker/') && !pathname.startsWith('/tracking/') && !pathname.startsWith('/bookings/') && <><NotificationInbox />{!['/dashboard', '/worker', '/admin'].includes(pathname) && <div className="fixed right-16 top-3 z-50 sm:hidden"><WorkspaceTools mobileOnly notifications={false} /></div>}<div className="hidden sm:block"><ThemeToggle /><SupportButton /></div></>}</Provider>;
}
