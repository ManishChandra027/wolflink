import { useEffect, useRef, useState } from 'react';
import { api, getApiMessage } from '../../lib/api.js';
import { Avatar } from '../common/Avatar.jsx';
import { toast } from 'sonner';

export function PublicProfileDialog({ userId, onClose, onMessage, onBlockChanged }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    let active = true;
    api.get(`/users/${userId}`).then((response) => { if (active) setProfile(response.data.data.user); }).catch((reason) => { if (active) setError(getApiMessage(reason)); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    let active = true;
    api.get('/users/me/blocked').then((response) => {
      if (active) setBlocked(response.data.data.users.some((item) => item.id === userId));
    }).catch(() => {});
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, []);

  async function blockProfile() {
    setActionBusy(true);
    try { await api.post(`/users/${userId}/block`); setBlocked(true); toast.success('User blocked. Messaging is unavailable for both of you.'); setConfirmBlock(false); await onBlockChanged?.(); onClose(); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setActionBusy(false); }
  }

  async function unblockProfile() {
    setActionBusy(true);
    try { await api.delete(`/users/${userId}/block`); setBlocked(false); toast.success('User unblocked'); await onBlockChanged?.(); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setActionBusy(false); }
  }

  async function submitReport(event) {
    event.preventDefault(); setActionBusy(true);
    try { await api.post(`/users/${userId}/report`, { reason: reportReason, details: reportDetails }); toast.success('Report submitted'); setReportOpen(false); setReportDetails(''); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setActionBusy(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#061F17]/55 p-3 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="relative my-auto w-full max-w-xs overflow-y-auto rounded-2xl border border-[#E8EFE9] bg-white px-5 pb-5 pt-8 shadow-[0_24px_80px_rgba(6,31,23,0.24)] sm:max-w-sm sm:px-7 sm:pb-7 sm:pt-9" style={{ maxHeight: 'calc(100dvh - 1.5rem)' }} role="dialog" aria-modal="true" aria-label={profile ? undefined : 'Public profile'} aria-labelledby={profile ? 'public-profile-title' : undefined}>
      <button className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-xl leading-none text-[#68726E] transition hover:bg-[#F3F4F2] hover:text-[#0F2D1F] focus-visible:outline-2 focus-visible:outline-[#1B4332]" type="button" aria-label="Close profile" onClick={onClose}>×</button>
      {!profile && !error && <p className="py-14 text-center text-sm text-[#68726E]" role="status">Loading profile…</p>}
      {error && <p className="py-14 text-center text-sm text-[#B91C1C]" role="alert">{error}</p>}
      {profile && <div className="text-center">
        <Avatar src={profile.avatar} name={profile.name} size="size-20 sm:size-24" className="mx-auto ring-4 ring-[#E8EFE9]" />
        <h2 id="public-profile-title" className="mt-4 break-words text-xl font-semibold tracking-tight text-[#0F2D1F]">{profile.name}</h2>
        <p className="mt-1 text-sm font-medium text-[#68726E]">@{profile.username}</p>
        <div className="mt-5 rounded-xl bg-[#F8F8F6] px-4 py-3.5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#68726E]">About</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-[#34443C]">{profile.bio || 'This person has not added a bio yet.'}</p>
        </div>
        {profile.phone && <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-4 py-3 text-left"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#E8EFE9] text-sm text-[#1B4332]" aria-hidden="true">☎</span><span><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#68726E]">Public phone</span><span className="mt-0.5 block text-sm font-medium text-[#1B4332]">{profile.phone}</span></span></div>}
        {confirmBlock ? <div className="mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-left"><p className="text-sm font-semibold text-[#7F1D1D]">Block {profile.name}?</p><p className="mt-1 text-xs leading-5 text-[#7F1D1D]">Messaging will be disabled for both of you. You can unblock them later from this profile or Privacy settings.</p><div className="mt-3 flex gap-2"><button className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" type="button" onClick={() => setConfirmBlock(false)}>Cancel</button><button className="flex-1 rounded-lg bg-[#B42318] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="button" disabled={actionBusy} onClick={blockProfile}>{actionBusy ? 'Blocking…' : 'Block user'}</button></div></div> : reportOpen ? <form className="mt-5 space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F8F8F6] p-4 text-left" onSubmit={submitReport}><label className="block text-xs font-semibold text-[#34443C]">Reason<select className="auth-input mt-1" value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></label><label className="block text-xs font-semibold text-[#34443C]">Details (optional)<textarea className="auth-input mt-1 min-h-20 resize-y" maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></label><div className="flex gap-2"><button className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold" type="button" onClick={() => setReportOpen(false)}>Cancel</button><button className="flex-1 rounded-lg bg-[#1B4332] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="submit" disabled={actionBusy}>{actionBusy ? 'Submitting…' : 'Submit report'}</button></div></form> : <><button className="mt-5 w-full rounded-xl bg-[#1B4332] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F2D1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]" type="button" disabled={blocked} onClick={() => onMessage(profile.id)}>{blocked ? 'Blocked' : 'Message'}</button><div className="mt-3 flex justify-center gap-5 text-xs">{blocked ? <button className="font-semibold text-[#1B4332] hover:underline disabled:opacity-60" type="button" disabled={actionBusy} onClick={unblockProfile}>{actionBusy ? 'Unblocking…' : 'Unblock user'}</button> : <button className="font-medium text-[#68726E] hover:text-[#B42318]" type="button" onClick={() => setConfirmBlock(true)}>Block user</button>}<button className="font-medium text-[#68726E] hover:text-[#1B4332]" type="button" onClick={() => setReportOpen(true)}>Report</button></div></>}
      </div>}
    </section>
  </div>;
}
