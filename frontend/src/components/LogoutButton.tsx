'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useSelector } from 'react-redux';
import { store, type RootState } from '@/store';
import { logout } from '@/store/authSlice';
import { chatAPI, getApiError } from '@/services/api';
import { loadSession } from '@/store/chatSlice';
import { disconnectSocket } from '@/hooks/useSocket';
import ConfirmDialog from './ConfirmDialog';

export default function LogoutButton({ className = '', onConfirmed }: { className?: string; onConfirmed?: () => void }) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const chat = store.getState().chat;
      if (!onConfirmed && chat.sessionId && (['PENDING', 'SEARCHING', 'ASSIGNED'].includes(chat.currentRequest?.status) || (!chat.currentRequest && ['NEED_LOCATION', 'CHOOSE_WORKER', 'SEARCHING'].includes(chat.state)))) {
        try { await chatAPI.stopSession(chat.sessionId, chat.currentRequest?.status); }
        catch (error) { await store.dispatch(loadSession(chat.sessionId)); throw error; }
      }
      if (onConfirmed) onConfirmed();
      else { disconnectSocket(); store.dispatch(logout()); router.replace(user?.role === 'WORKER' ? '/professional-login' : '/login'); }
      setOpen(false);
    } catch (error) { setError(getApiError(error, 'Could not stop the active search. Please try again.')); }
    finally { setBusy(false); }
  };
  return <><button type="button" onClick={() => { setError(''); setOpen(true); }} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--soft)] ${className}`}><LogOut size={17} />Log out</button>{open && <ConfirmDialog title="Are you sure you want to log out?" confirmLabel="Log out" busy={busy} error={error} onCancel={() => setOpen(false)} onConfirm={confirm}><p>Any active professional search will be stopped before you leave.</p></ConfirmDialog>}</>;
}
