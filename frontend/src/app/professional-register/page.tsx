'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, FileText, Image as ImageIcon, PlusCircle, UploadCloud } from 'lucide-react';
import Brand from '@/components/Brand';
import LocationPicker, { PickedLocation } from '@/components/LocationPicker';
import FaceCheck from '@/components/FaceCheck';
import { clearError, registerProfessional } from '@/store/authSlice';
import { platformAPI } from '@/services/api';
import { uploadToS3 } from '@/services/upload';
import type { AppDispatch, RootState } from '@/store';

type UploadState = {
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  key?: string;
  error?: string;
  preview?: string;
  isPdf?: boolean;
};

export default function ProfessionalRegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error, user } = useSelector((state: RootState) => state.auth);
  const [categories, setCategories] = useState<any[]>([]);
  const [custom, setCustom] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const uploadOrder = useRef({ profile: 0, pan: 0 });
  const previewUrls = useRef({ profile: '', pan: '' });
  useEffect(() => () => { uploadOrder.current.profile++; uploadOrder.current.pan++; Object.values(previewUrls.current).forEach(url => { if (url) URL.revokeObjectURL(url); }); }, []);
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', categoryKeys: [] as string[], customCategory: '', categoryDescription: '', bio: '', panNumber: '',
    location: {} as Partial<PickedLocation>,
    profilePhotoKey: '', panDocumentKey: '', faceFrontKey: '', faceLeftKey: '', faceRightKey: '',
  });
  const [panUpload, setPanUpload] = useState<UploadState>({ status: 'idle' });
  const [profileUpload, setProfileUpload] = useState<UploadState>({ status: 'idle' });

  useEffect(() => { dispatch(clearError()); platformAPI.getCategories().then(r => setCategories(r.data.data)).catch(() => {}); }, [dispatch]);
  useEffect(() => { if (user?.role === 'WORKER') router.replace('/worker'); }, [router, user]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (loading || panUpload.status !== 'uploaded' || profileUpload.status !== 'uploaded' || !form.panDocumentKey || !form.profilePhotoKey || !form.faceFrontKey || !form.faceLeftKey || !form.faceRightKey) {
      setFormError('Upload your PAN card and profile photo, and complete the camera check');
      return;
    }
    dispatch(registerProfessional({
      ...form,
      customCategory: custom ? form.customCategory : undefined,
      address: form.location.address,
      latitude: form.location.latitude,
      longitude: form.location.longitude,
    }));
  };

  const handleUpload = async (purpose: 'profile' | 'pan', file?: File | null) => {
    if (!file) return;
    const attempt = ++uploadOrder.current[purpose];
    setForm(current => ({ ...current, [purpose === 'pan' ? 'panDocumentKey' : 'profilePhotoKey']: '' }));
    if (previewUrls.current[purpose]) URL.revokeObjectURL(previewUrls.current[purpose]);
    previewUrls.current[purpose] = '';
    const max = 5 * 1024 * 1024;
    if (file.size > max || file.size < 1024) {
      if (purpose === 'pan') setPanUpload({ status: 'error', error: 'PAN file must be between 1 KB and 5 MB.' });
      else setProfileUpload({ status: 'error', error: 'Profile photo must be between 1 KB and 5 MB.' });
      return;
    }
    const validTypes = purpose === 'pan' ? ['image/jpeg', 'image/png', 'application/pdf'] : ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      if (purpose === 'pan') setPanUpload({ status: 'error', error: 'PAN files must be JPG, PNG, or PDF.' });
      else setProfileUpload({ status: 'error', error: 'Profile photo must be JPG or PNG.' });
      return;
    }

    const preview = URL.createObjectURL(file);
    previewUrls.current[purpose] = preview;
    const isPdf = file.type === 'application/pdf';
    if (purpose === 'pan') setPanUpload({ status: 'uploading', preview, isPdf, error: undefined });
    else setProfileUpload({ status: 'uploading', preview, isPdf, error: undefined });

    try {
      const key = await uploadToS3(file, purpose);
      if (attempt !== uploadOrder.current[purpose]) return;
      if (purpose === 'pan') {
        setForm((current) => ({ ...current, panDocumentKey: key }));
        setPanUpload({ status: 'uploaded', key, preview, isPdf, error: undefined });
      } else {
        setForm((current) => ({ ...current, profilePhotoKey: key }));
        setProfileUpload({ status: 'uploaded', key, preview, isPdf, error: undefined });
      }
    } catch (err: any) {
      if (attempt !== uploadOrder.current[purpose]) return;
      const message = err?.message || 'Upload failed.';
      if (purpose === 'pan') setPanUpload({ status: 'error', error: message, preview });
      else setProfileUpload({ status: 'error', error: message, preview });
    }
  };

  const faceReady = (data: { front: string; left: string; right: string } | null) => {
    setForm((current) => ({ ...current, faceFrontKey: data?.front || '', faceLeftKey: data?.left || '', faceRightKey: data?.right || '' }));
  };

  const ready = panUpload.status === 'uploaded' && profileUpload.status === 'uploaded' && !!form.panDocumentKey && !!form.profilePhotoKey && !!form.faceFrontKey && !!form.faceLeftKey && !!form.faceRightKey;

  return <main className="hf-page portal-professional min-h-screen px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl"><div className="mb-6 flex items-center justify-between"><Brand /><Link href="/register" className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-blue-600"><ArrowLeft size={16} />Homeowner registration</Link></div><div className="hf-panel rounded-[2rem] p-6 sm:p-10"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700"><BadgeCheck size={14} />Verified network application</span><h1 className="mt-5 font-display text-4xl font-bold tracking-[-.05em] text-[var(--text)]">Grow your business with Zoon.</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tell us about your work. Every professional application is reviewed before jobs become available.</p></div>
    <form onSubmit={submit} className="mt-9 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-[var(--text)]">Full name <small className="block font-normal text-[var(--muted)]">Enter it exactly as printed on your PAN card.</small><input required className="hf-input mt-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
      <label className="text-sm font-semibold text-[var(--text)]">Phone<input required className="hf-input mt-2" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></label>
      <label className="text-sm font-semibold text-[var(--text)]">Email<input required type="email" className="hf-input mt-2" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
      <label className="text-sm font-semibold text-[var(--text)]">Password<input required minLength={8} type="password" className="hf-input mt-2" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></label>
      <div className="sm:col-span-2"><div className="flex items-center justify-between"><label className="text-sm font-semibold text-[var(--text)]">Services you provide</label><button type="button" onClick={()=>setCustom(!custom)} className="flex items-center gap-1.5 text-xs font-bold text-teal-600"><PlusCircle size={15}/>{custom?'Remove new request':'Request another category'}</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{categories.map(c=>{const checked=form.categoryKeys.includes(c.key);return <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-semibold ${checked?'border-blue-400 bg-blue-50 text-blue-800':'border-[var(--border)] bg-[var(--panel)] text-[var(--text)]'}`}><input type="checkbox" checked={checked} onChange={()=>setForm({...form,categoryKeys:checked?form.categoryKeys.filter(k=>k!==c.key):[...form.categoryKeys,c.key]})}/>{c.name}</label>})}</div>{custom&&<div className="mt-3 grid gap-3 sm:grid-cols-2"><input required className="hf-input" placeholder="e.g. Solar panel technician" value={form.customCategory} onChange={e=>setForm({...form,customCategory:e.target.value})}/><input className="hf-input" placeholder="Describe this service" value={form.categoryDescription} onChange={e=>setForm({...form,categoryDescription:e.target.value})}/></div>}</div>
      <label className="text-sm font-semibold text-[var(--text)]">PAN number<input required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength={10} className="hf-input mt-2 uppercase" placeholder="ABCDE1234F" value={form.panNumber} onChange={e=>setForm({...form,panNumber:e.target.value.toUpperCase()})}/></label>
      <div className="space-y-2 text-sm font-semibold text-[var(--text)]">PAN card file
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)] p-4 text-center">
          <input accept="image/png,image/jpeg,application/pdf" type="file" disabled={loading} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void handleUpload('pan', file); }} />
          {panUpload.status === 'uploading' ? <><UploadCloud className="mb-2 text-blue-500" size={20} /> <span className="text-xs text-blue-600">Uploading…</span></> : panUpload.status === 'uploaded' ? <><CheckCircle2 className="mb-2 text-emerald-600" size={20} /> <span className="text-xs text-emerald-700">Uploaded</span></> : <><FileText className="mb-2 text-[var(--muted)]" size={20} /><span className="text-xs text-[var(--muted)]">Upload PAN card (JPG / PNG / PDF)</span></>}
        </label>
        {panUpload.preview && panUpload.status !== 'error' && (panUpload.isPdf ? <a href={panUpload.preview} target="_blank" rel="noreferrer" className="text-xs text-[var(--brand)]">Preview selected PAN PDF</a> : <img src={panUpload.preview} alt="PAN preview" className="h-24 w-full rounded-2xl object-contain" />)}
        {panUpload.error && <p className="text-xs text-rose-600">{panUpload.error}</p>}
      </div>
      <div className="space-y-2 text-sm font-semibold text-[var(--text)]">Profile photo
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)] p-4 text-center">
          <input accept="image/png,image/jpeg" type="file" disabled={loading} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void handleUpload('profile', file); }} />
          {profileUpload.status === 'uploading' ? <><UploadCloud className="mb-2 text-blue-500" size={20} /> <span className="text-xs text-blue-600">Uploading…</span></> : profileUpload.status === 'uploaded' ? <><CheckCircle2 className="mb-2 text-emerald-600" size={20} /> <span className="text-xs text-emerald-700">Uploaded</span></> : <><ImageIcon className="mb-2 text-[var(--muted)]" size={20} /><span className="text-xs text-[var(--muted)]">Upload profile photo</span></>}
        </label>
        {profileUpload.preview && profileUpload.status !== 'error' && (<img src={profileUpload.preview} alt="Profile preview" className="h-24 w-full rounded-2xl object-cover" />)}
        {profileUpload.error && <p className="text-xs text-rose-600">{profileUpload.error}</p>}
      </div>
      <div className="sm:col-span-2"><FaceCheck onReady={faceReady} disabled={loading} /></div>
      <label className="sm:col-span-2 text-sm font-semibold text-[var(--text)]">Professional bio<textarea required rows={3} className="hf-input mt-2 h-auto resize-none" placeholder="Experience, certifications, and the work you specialise in" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
      <div className="sm:col-span-2"><LocationPicker value={form.location} onChange={location=>setForm({...form,location})}/></div>
      {(error || formError) && <div role="alert" className="sm:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error || formError}</div>}
      <button disabled={loading || !ready} className="hf-primary sm:col-span-2 flex items-center justify-center gap-2 px-5 py-3.5 disabled:opacity-60">{loading?'Submitting application…':'Submit for admin review'}<ArrowRight size={17}/></button>
    </form></div></div></main>;
}
