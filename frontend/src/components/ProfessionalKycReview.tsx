 'use client';
import { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { adminAPI, getApiError } from '@/services/api';

export default function ProfessionalKycReview({ worker, onClose, onReviewed }: { worker: any; onClose: () => void; onReviewed: () => void }) {
  const [currentWorker, setCurrentWorker] = useState(worker);
  const [urls, setUrls] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setUrls(null); setError('');
    adminAPI.getWorkerDocument(worker.id).then(response => { if (active) setUrls(response.data.data); }).catch(err => { if (active) setError(getApiError(err, 'Could not load private documents.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [worker.id, refresh]);
  useEffect(() => { setCurrentWorker(worker); }, [worker]);
  useEffect(() => {
    if (!urls?.expiresAt) return;
    const timer = window.setTimeout(() => { setUrls(null); setError('Document links expired. Refresh to continue reviewing.'); }, Math.max(0, new Date(urls.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [urls]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose, saving]);
  const decide = async (status: 'APPROVED' | 'REJECTED') => {
    setSaving(true); setError('');
    try { await adminAPI.reviewWorker(worker.id, status, note.trim() || undefined); onReviewed(); onClose(); }
    catch (err) { setError(getApiError(err, 'Could not save review.')); }
    finally { setSaving(false); }
  };
  const rerunChecks = async () => {
    setChecking(true); setError('');
    try {
      const response = await adminAPI.rerunWorkerKyc(worker.id);
      setCurrentWorker((current: any) => ({ ...current, ...response.data.data }));
      setRefresh(n => n + 1);
      onReviewed();
    } catch (err) { setError(getApiError(err, 'Automatic checks could not be completed.')); }
    finally { setChecking(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="kyc-title" className="hf-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6 text-[var(--text)]">
    <div className="flex items-start justify-between gap-4"><div><h2 id="kyc-title" className="text-xl font-bold">Review {worker.user?.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">Private identity documents. Links expire after five minutes.</p></div><button autoFocus type="button" disabled={saving} onClick={onClose} aria-label="Close KYC review"><X/></button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--soft)] p-3 text-sm"><b>PAN document</b><p>{currentWorker.kycReport?.document?.passed ? 'Document text matches the submitted name and PAN' : 'Document needs manual review'}</p></div><div className="rounded-xl bg-[var(--soft)] p-3 text-sm"><b>PAN official records</b><p>{currentWorker.panVerified ? 'Automatically verified and name matched' : 'Manual review required'}</p></div><div className="rounded-xl bg-[var(--soft)] p-3 text-sm"><b>Face checks</b><p>{currentWorker.faceVerified ? 'Automatic identity, quality and pose checks passed' : 'Manual review required'}</p></div></div>
    <p className="mt-4 rounded-xl border border-[var(--border)] p-3 text-sm">{currentWorker.applicationNote || 'Legacy application. Review the identity documents manually.'}</p>
    {currentWorker.kycReport && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Automatic check details</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--soft)] p-3 text-xs">{JSON.stringify(currentWorker.kycReport, null, 2)}</pre></details>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Submitted documents</h3><div className="flex items-center gap-3"><button type="button" disabled={loading || checking} onClick={() => setRefresh(n => n + 1)} className="flex items-center gap-1 text-xs text-[var(--brand)]"><RefreshCw size={14}/>Refresh links</button><button type="button" disabled={loading || checking} onClick={rerunChecks} className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">{checking ? 'Checking…' : 'Run automatic checks again'}</button></div></div>
    {loading && <p role="status" className="py-6 text-sm text-[var(--muted)]">Loading private document links...</p>}
    {urls?.panDocumentUrl && <a href={urls.panDocumentUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl bg-[var(--soft)] px-4 py-3 text-sm font-bold text-[var(--brand)]">Open PAN document (image or PDF)</a>}
    {urls?.legacyDocument && <p className="mt-3 text-sm text-[var(--warning)]">This account has a legacy document. It has not been migrated to private S3 storage; arrange a new upload before approving identity.</p>}
    {urls && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['profilePhotoUrl', 'Profile'], ['faceFrontUrl', 'Front'], ['faceLeftUrl', 'Left'], ['faceRightUrl', 'Right']].map(([key, label]) => <figure key={key} className="rounded-xl border border-[var(--border)] p-2">{urls[key] ? <a href={urls[key]} target="_blank" rel="noreferrer"><img src={urls[key]} alt={`${label} identity photo`} className="aspect-square w-full rounded-lg object-contain" referrerPolicy="no-referrer"/></a> : <div className="grid aspect-square place-items-center text-xs text-[var(--muted)]">Not uploaded</div>}<figcaption className="mt-2 text-center text-xs font-semibold">{label}</figcaption></figure>)}</div>}
    {error && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
    <label className="mt-5 block text-sm font-semibold">Review note<textarea maxLength={1000} className="hf-input mt-2 h-24" value={note} onChange={e => setNote(e.target.value)} placeholder="Record manual checks or changes needed"/></label>
    <p className="mt-3 text-xs text-[var(--muted)]">Automatic checks do not approve the account. Record the manual document and identity checks in your review note before approving. Mismatches must be resolved and checked again.</p>
    <div className="mt-4 flex gap-3"><button disabled={saving || checking} type="button" onClick={() => decide('APPROVED')} className="hf-primary px-5 py-3 disabled:opacity-50">Approve professional</button><button disabled={saving || checking} type="button" onClick={() => decide('REJECTED')} className="rounded-xl border border-[var(--border)] px-5 py-3 text-[var(--danger)] disabled:opacity-50">Request changes / reject</button></div>
  </section></div>;
}
