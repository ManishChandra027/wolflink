import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar } from '../../components/common/Avatar.jsx';
import { SettingsLayout } from '../../layouts/SettingsLayout.jsx';

export function AccountSettingsPage() {
  const { user } = useSelector((state) => state.auth);
  return <SettingsLayout>
    <PageHeading eyebrow="Profile" title="My profile" description="Your saved WolfLink profile information." />
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-col items-center gap-4 border-b border-[#E5E7EB] pb-6 text-center sm:flex-row sm:text-left">
        <Avatar src={user?.avatar} name={user?.name} size="size-24" />
        <div className="min-w-0"><h2 className="break-words text-2xl font-semibold text-[#0F2D1F]">{user?.name}</h2><p className="mt-1 text-[#68726E]">@{user?.username}</p><p className="mt-3 max-w-xl whitespace-pre-wrap text-sm leading-6 text-[#4B5B52]">{user?.bio || 'No profile introduction added.'}</p></div>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <ProfileValue label="Display name" value={user?.name} />
        <ProfileValue label="Username" value={user?.username ? `@${user.username}` : ''} />
        <ProfileValue label="Phone number" value={user?.phone || 'Not added'} />
        <ProfileValue label="Phone visibility" value={user?.phone ? (user.isPhonePublic ? 'Public' : 'Private') : 'Not applicable'} />
      </dl>
      <div className="mt-7 flex flex-wrap gap-3 border-t border-[#E5E7EB] pt-6">
        <Link to="/settings/edit-profile" className="rounded-lg bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2D1F]">Edit profile</Link>
        <Link to="/settings/account" className="rounded-lg border border-[#DCE3DE] px-5 py-2.5 text-sm font-semibold text-[#1B4332] hover:bg-[#F3F4F2]">Account details</Link>
      </div>
    </section>
  </SettingsLayout>;
}

export function PageHeading({ eyebrow, title, description }) {
  return <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B4332]">{eyebrow}</p><h1 className="mt-1 font-serif text-3xl text-[#0F2D1F] sm:text-4xl">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-[#68726E]">{description}</p>}</header>;
}

function ProfileValue({ label, value }) {
  return <div className="rounded-xl bg-[#F8F8F6] p-4"><dt className="text-xs font-semibold uppercase tracking-wider text-[#68726E]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#1F1F1F]">{value || '—'}</dd></div>;
}
