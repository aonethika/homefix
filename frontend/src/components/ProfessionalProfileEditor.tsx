 'use client';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { updateUser } from '@/store/authSlice';
import { workerAPI, getApiError } from '@/services/api';

export default function ProfessionalProfileEditor() {
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const [form, setForm] = useState({ bio: user?.workerProfile?.bio || '', address: user?.workerProfile?.address || '', phone: user?.phone || '', isPublic: user?.workerProfile?.isPublic || false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="hf-panel space-y-5 rounded-2xl p-6" onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { const response = await workerAPI.updateProfile(form); dispatch(updateUser({ phone: form.phone, workerProfile: response.data.data })); setMessage('Profile saved.'); } catch (error) { setMessage(getApiError(error, 'Could not save profile')); } finally { setBusy(false); } }}>
    <div><h2 className="text-xl font-bold">Your professional profile</h2><p className="mt-2 text-sm text-[var(--muted)]">Tell customers about your experience, skills, and the work you enjoy.</p></div>
    <label className="block text-sm font-semibold">Bio<textarea rows={5} maxLength={2000} className="hf-input mt-2 h-36" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}/></label>
    <label className="block text-sm font-semibold">Base address<input maxLength={300} className="hf-input mt-2" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></label>
    <label className="block text-sm font-semibold">Contact phone<input type="tel" maxLength={30} className="hf-input mt-2" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
    <label className="flex items-start gap-3 rounded-xl bg-[var(--soft)] p-4"><input className="mt-1" type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })}/><span><b>Make my profile public</b><span className="mt-1 block text-sm text-[var(--muted)]">Once approved, your name, services, bio, and reviews appear in Professionals without login. Customers can request appointments. Your phone, identity documents, and exact location stay private.</span></span></label>
    <p className="text-xs text-[var(--muted)]">Your verified name and services are managed through application review. Contact support to change them.</p>
    {message && <p role="status" className="text-sm">{message}</p>}<button disabled={busy} className="hf-primary px-6 py-3 disabled:opacity-50">{busy ? 'Saving...' : 'Save profile'}</button>
  </form>;
}
