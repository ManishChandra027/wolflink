import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { profileUpdated, sessionExpired } from '../../features/auth/authSlice.js';
import { api, getApiMessage } from '../../lib/api.js';
import { Avatar } from '../../components/common/Avatar.jsx';
import { SettingsLayout } from '../../layouts/SettingsLayout.jsx';
import { PageHeading } from './AccountSettingsPage.jsx';

export function EditProfilePage() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: user?.name || '', username: user?.username || '', bio: user?.bio || '', phone: user?.phone || '' });
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setForm({ name: user?.name || '', username: user?.username || '', bio: user?.bio || '', phone: user?.phone || '' }), [user]);

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const response = await api.patch('/users/me', form); dispatch(profileUpdated(response.data.data.user)); toast.success('Profile saved'); }
    catch (reason) { setError(getApiMessage(reason)); toast.error(getApiMessage(reason)); }
    finally { setBusy(false); }
  }
  async function uploadAvatar(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Choose a JPG, PNG, or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Choose an image smaller than 5 MB.'); return; }
    setAvatarBusy(true);
    try { const response = await api.post('/users/me/avatar', file, { headers: { 'Content-Type': file.type } }); dispatch(profileUpdated(response.data.data.user)); toast.success('Profile photo uploaded'); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setAvatarBusy(false); }
  }
  async function removeAvatar() {
    setAvatarBusy(true);
    try { const response = await api.delete('/users/me/avatar'); dispatch(profileUpdated(response.data.data.user)); toast.success('Default avatar restored'); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setAvatarBusy(false); }
  }

  return <SettingsLayout><PageHeading eyebrow="Profile" title="Edit profile" description="Update the information other WolfLink members see on your profile." />
    <form className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8" onSubmit={saveProfile}>
      <div className="flex items-center gap-4 border-b border-[#E5E7EB] pb-6"><Avatar src={user?.avatar} name={user?.name} size="size-16" /><div><p className="text-sm font-semibold text-[#1F1F1F]">Profile photo</p><p className="mt-1 text-xs text-[#68726E]">JPG, PNG, or WebP · up to 5 MB</p><div className="mt-2 flex gap-4"><button className="text-sm font-semibold text-[#1B4332] hover:underline disabled:opacity-50" type="button" disabled={avatarBusy} onClick={() => fileRef.current?.click()}>{avatarBusy ? 'Uploading…' : 'Upload photo'}</button>{user?.avatar && <button className="text-sm text-[#68726E] hover:underline disabled:opacity-50" type="button" disabled={avatarBusy} onClick={removeAvatar}>Remove</button>}</div></div><input className="sr-only" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} /></div>
      <label className="mt-5 block text-sm font-medium text-[#1F1F1F]">Display name<input className="auth-input mt-2" autoComplete="name" required minLength={2} maxLength={40} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label className="mt-4 block text-sm font-medium text-[#1F1F1F]">Username<input className="auth-input mt-2" autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))} /><span className="mt-1 block text-xs text-[#68726E]">Use 3–24 letters, numbers, or underscores.</span></label>
      <label className="mt-4 block text-sm font-medium text-[#1F1F1F]">About<textarea className="auth-input mt-2 min-h-24 resize-y" maxLength={160} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} /></label>
      <label className="mt-4 block text-sm font-medium text-[#1F1F1F]">Phone number <span className="font-normal text-[#68726E]">(optional)</span><input className="auth-input mt-2" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
      {error && <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#B91C1C]" role="alert">{error}</p>}
      <button className="mt-6 rounded-lg bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2D1F] disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  </SettingsLayout>;
}

export function AccountDetailsPage() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  return <SettingsLayout><PageHeading eyebrow="Account" title="Account details" description="Your sign-in email and verification status." />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#F8F8F6] p-4"><div><p className="font-medium text-[#1F1F1F]">Email address</p><p className="mt-1 break-all text-sm text-[#68726E]">{user?.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user?.emailVerified ? 'bg-[#E8EFE9] text-[#1B4332]' : 'bg-[#FFF6D9] text-[#755B06]'}`}>{user?.emailVerified ? 'Verified' : 'Not verified'}</span></div>
      {!user?.emailVerified && <div className="mt-5 rounded-xl border border-[#E5E7EB] p-4"><p className="text-sm leading-6 text-[#68726E]">Verify your email to start and use conversations. Your account settings remain available until then.</p><button className="mt-4 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2D1F]" onClick={() => navigate('/verify-email')}>Verify email</button></div>}
    </section>
  </SettingsLayout>;
}

export function PrivacySettingsPage() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  useEffect(() => { api.get('/users/me/blocked').then((response) => setBlockedUsers(response.data.data.users)).catch(() => {}); }, []);
  async function updatePhonePrivacy(event) {
    const isPhonePublic = event.target.checked;
    setBusy(true);
    try { const response = await api.patch('/users/me', { isPhonePublic }); dispatch(profileUpdated(response.data.data.user)); toast.success('Privacy setting saved'); }
    catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setBusy(false); }
  }
  async function unblockUser(id) {
    try { await api.delete(`/users/${id}/block`); setBlockedUsers((current) => current.filter((item) => item.id !== id)); toast.success('User unblocked'); }
    catch (reason) { toast.error(getApiMessage(reason)); }
  }
  return <SettingsLayout><PageHeading eyebrow="Control your information" title="Privacy" description="Decide what personal information can be discovered by other people." />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><h2 className="text-lg font-semibold text-[#0F2D1F]">Phone number visibility</h2><p className="mt-1 text-sm leading-6 text-[#68726E]">Your number stays private by default. When public, people may find you by searching for the exact number.</p>
      <label className="mt-6 flex items-start gap-3 rounded-xl bg-[#F3F4F2] p-4 text-sm"><input className="mt-1 size-4 accent-[#1B4332]" type="checkbox" checked={Boolean(user?.isPhonePublic)} disabled={!user?.phone || busy} onChange={updatePhonePrivacy} /><span><strong className="text-[#1F1F1F]">Make my phone number public</strong><span className="mt-1 block text-[#68726E]">{user?.phone ? `Saved number: ${user.phone}` : 'Add a phone number from Edit profile to enable this option.'}</span></span></label>
      <p className="mt-5 text-xs leading-5 text-[#68726E]">Your phone number is not included in public profile details unless you enable this setting.</p>
    </section>
    <section className="mt-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><h2 className="text-lg font-semibold text-[#0F2D1F]">Blocked users</h2><p className="mt-1 text-sm text-[#68726E]">Blocked people cannot start conversations with you or send messages.</p>
      {blockedUsers.length ? <ul className="mt-4 divide-y divide-[#E5E7EB]">{blockedUsers.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-[#1F1F1F]">{item.name}</p><p className="text-xs text-[#68726E]">@{item.username}</p></div><button className="shrink-0 rounded-lg border border-[#DCE3DE] px-3 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#F3F4F2]" type="button" onClick={() => unblockUser(item.id)}>Unblock</button></li>)}</ul> : <p className="mt-4 rounded-lg bg-[#F8F8F6] p-3 text-sm text-[#68726E]">You haven’t blocked anyone.</p>}
    </section>
  </SettingsLayout>;
}

export function SecuritySettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function changePassword(event) {
    event.preventDefault(); setError('');
    if (password.newPassword.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password.newPassword !== password.confirmPassword) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try { await api.post('/auth/change-password', { currentPassword: password.currentPassword, newPassword: password.newPassword }); toast.success('Password changed. Please sign in again.'); dispatch(sessionExpired()); navigate('/login', { replace: true, state: { passwordChanged: true } }); }
    catch (reason) { setError(getApiMessage(reason)); toast.error(getApiMessage(reason)); }
    finally { setBusy(false); }
  }
  return <SettingsLayout><PageHeading eyebrow="Security" title="Password & security" description="Keep your account secure by using a unique password." />
    <form className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8" onSubmit={changePassword}>
      <h2 className="font-semibold text-[#0F2D1F]">Change password</h2>
      {[['Current password', 'currentPassword', 'current-password', 0], ['New password', 'newPassword', 'new-password', 8], ['Confirm new password', 'confirmPassword', 'new-password', 8]].map(([label, field, autoComplete, minLength]) => <label key={field} className="mt-4 block text-sm font-medium text-[#1F1F1F]">{label}<input className="auth-input mt-2" type="password" autoComplete={autoComplete} required minLength={minLength || undefined} maxLength={72} value={password[field]} onChange={(event) => setPassword((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
      {error && <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#B91C1C]" role="alert">{error}</p>}
      <button className="mt-6 rounded-lg bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2D1F] disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Updating…' : 'Change password'}</button>
    </form>
  </SettingsLayout>;
}

export function InformationSettingsPage({ kind }) {
  const pages = {
    about: { eyebrow: 'About', title: 'About WolfLink', description: 'WolfLink is a quieter place for private, one-to-one conversations. Find people by name or username, then connect through reliable messaging.', footer: 'WolfLink V1 · Stay Connected.' },
    terms: { eyebrow: 'Future scope', title: 'Terms & policies', description: 'Terms of service and detailed privacy information will be published here before public launch.' },
  };
  const page = pages[kind];
  return <SettingsLayout><PageHeading eyebrow={page.eyebrow} title={page.title} />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><p className="max-w-2xl text-sm leading-7 text-[#68726E]">{page.description}</p>{page.footer && <p className="mt-5 text-xs text-[#68726E]">{page.footer}</p>}{kind !== 'about' && <span className="mt-6 inline-flex rounded-full bg-[#E8EFE9] px-3 py-1 text-xs font-semibold text-[#1B4332]">Planned</span>}</section>
  </SettingsLayout>;
}

export function NotificationSettingsPage() {
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(() => supported ? Notification.permission : 'unsupported');
  const [enabled, setEnabled] = useState(() => localStorage.getItem('wolflink:notifications') === 'true');
  async function enableNotifications() {
    if (!supported) { toast.error('Browser notifications are not supported here.'); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setEnabled(true);
      localStorage.setItem('wolflink:notifications', 'true');
      toast.success('Browser notifications enabled');
    } else {
      setEnabled(false);
      localStorage.setItem('wolflink:notifications', 'false');
      toast.error(result === 'denied' ? 'Allow notifications from your browser site settings.' : 'Notification permission was not granted.');
    }
  }
  function toggleNotifications(value) {
    setEnabled(value);
    localStorage.setItem('wolflink:notifications', String(value));
    toast.success(value ? 'Notifications enabled' : 'Notifications paused');
  }
  return <SettingsLayout><PageHeading eyebrow="Preferences" title="Notifications" description="Choose whether WolfLink shows browser notifications for messages outside your open conversation." />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><label className="flex items-center justify-between gap-4"><span><strong className="block text-sm text-[#1F1F1F]">Browser message notifications</strong><span className="mt-1 block text-sm text-[#68726E]">Shows a quiet browser notification when a message arrives while you are away from that conversation. No sound is played.</span></span><input className="size-5 accent-[#1B4332]" type="checkbox" checked={enabled} disabled={!supported || permission !== 'granted'} onChange={(event) => toggleNotifications(event.target.checked)} /></label>
      {permission === 'default' && <button className="mt-5 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2D1F]" type="button" onClick={enableNotifications}>Allow browser notifications</button>}
      {permission === 'denied' && <p className="mt-4 rounded-lg bg-[#FFF6D9] p-3 text-sm text-[#755B06]" role="status">Notifications are blocked by your browser. Allow them for this site in browser settings, then return here.</p>}
      {permission === 'unsupported' && <p className="mt-4 text-sm text-[#68726E]">This browser does not support desktop notifications.</p>}
      {permission === 'granted' && <p className="mt-4 text-xs text-[#68726E]">Browser permission: allowed. You can pause WolfLink notifications with the switch above.</p>}
    </section>
  </SettingsLayout>;
}

export function AppearanceSettingsPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('wolflink:theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('wolflink:theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  return <SettingsLayout><PageHeading eyebrow="Preferences" title="Appearance" description="Choose a theme for your WolfLink workspace." />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8"><label className="flex items-center justify-between gap-4"><span><strong className="block text-sm text-[#1F1F1F]">Dark mode</strong><span className="mt-1 block text-sm text-[#68726E]">Apply a darker surface theme across the app on this device.</span></span><input className="size-5 accent-[#1B4332]" type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} /></label></section>
  </SettingsLayout>;
}
