import { Link } from 'react-router-dom';
import { Brand } from '../Brand.jsx';
import { Avatar } from '../common/Avatar.jsx';

export function ChatSidebar({
  user, submitting, conversations, loadingConversations, selected, selectConversation,
  query, setQuery, searching, searchError, results, busy,
  openConversation, pageError, onLogout, onViewProfile, onUpdateConversationPreference,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleConversations = [...conversations]
    .filter((conversation) => {
      const person = conversation.participants.find((item) => item.id !== user?.id);
      return !normalizedQuery || `${person?.name || ''} ${person?.username || ''} ${conversation.lastMessage?.text || ''}`.toLowerCase().includes(normalizedQuery.replace(/^@/, ''));
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(b.unreadCount > 0) - Number(a.unreadCount > 0));
  return (
    <aside className={`${selected ? 'hidden' : 'flex'} h-full min-h-0 w-full flex-col overflow-hidden bg-[#061F17] p-5 text-white md:flex md:w-80 md:p-6`}>
      <Brand />
      <div className="mt-8 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Chats</h1>
        <Link className="rounded-lg border border-white/15 px-3 py-2 text-xs text-[#E8EFE9] hover:bg-white/10" to="/settings">Settings</Link>
      </div>
      <div className="mt-5">
        <label className="sr-only" htmlFor="people-search">Find people by name, username, or public phone</label>
        <div className="flex gap-2">
          <input id="people-search" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#E8EFE9]/50 focus:border-[#D4AF37]" placeholder="Search people or chats…" value={query} onChange={(event) => setQuery(event.target.value)} disabled={!user?.emailVerified} />
        </div>
        {!user?.emailVerified && <p className="mt-2 text-xs leading-5 text-[#E8EFE9]/70">Verify your email in <Link className="text-[#D4AF37] underline" to="/settings">Account Settings</Link> before starting conversations.</p>}
      </div>
      {searching && <p className="mt-2 text-xs text-[#E8EFE9]/60" role="status">Searching…</p>}
      {searchError && <p className="mt-3 text-xs leading-5 text-[#F2DFA3]" role="status">{searchError}</p>}
      {results.length > 0 && <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#0B2A20] p-2" aria-label="People search results">
        {results.map((person) => <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5" key={person.id}>
          <button type="button" onClick={() => onViewProfile(person.id)} aria-label={`View ${person.name}'s profile`}><Avatar src={person.avatar} name={person.name} size="size-9" /></button>
          <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onViewProfile(person.id)}><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-xs text-[#E8EFE9]/60">{person.username ? `@${person.username}` : person.phone || ''}</span></button>
          <button className="rounded-md px-2 py-1 text-xs font-semibold text-[#D4AF37] hover:bg-white/10 disabled:opacity-50" disabled={busy} onClick={() => openConversation(person.id)} type="button">Chat</button>
        </div>)}
      </div>}
      <div className="mt-7 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8EFE9]/60">Recent chats</h2><span className="text-xs text-[#E8EFE9]/40">{visibleConversations.length}</span></div>
      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {loadingConversations && !conversations.length && user?.emailVerified && <div className="space-y-2 p-2" role="status" aria-label="Loading conversations"><div className="h-14 animate-pulse rounded-xl bg-white/10" /><div className="h-14 animate-pulse rounded-xl bg-white/10" /></div>}
        {!user?.emailVerified && <p className="rounded-lg bg-white/5 p-3 text-sm text-[#E8EFE9]/65">Your inbox is available after email verification.</p>}
        {user?.emailVerified && !loadingConversations && !conversations.length && <p className="rounded-lg bg-white/5 p-3 text-sm text-[#E8EFE9]/65">No conversations yet. Search for a person to start one.</p>}
        {user?.emailVerified && normalizedQuery && conversations.length > 0 && !visibleConversations.length && <p className="rounded-lg bg-white/5 p-3 text-sm text-[#E8EFE9]/65">No chats match “{query}”.</p>}
        {visibleConversations.map((conversation) => {
          const person = conversation.participants.find((item) => item.id !== user?.id);
          return <div className={`relative flex w-full items-center gap-3 rounded-xl p-3 transition ${selected?.id === conversation.id ? 'bg-[#1B4332]' : 'hover:bg-white/5'}`} key={conversation.id}>
            <button type="button" onClick={() => person && onViewProfile(person.id)} aria-label={`View ${person?.name || 'person'} profile`}><Avatar src={person?.avatar} name={person?.name} size="size-10" /></button>
            <button className="min-w-0 flex-1 text-left" type="button" onClick={() => selectConversation(conversation)}><span className="block truncate text-sm font-medium">{person?.name || 'WolfLink user'}</span><span className="block truncate text-xs text-[#E8EFE9]/55">{conversation.lastMessage?.text || (person?.username ? `@${person.username}` : 'Private conversation')}</span></button>
            {(conversation.isPinned || conversation.isMuted) && <span className="shrink-0 text-[10px]" aria-label={`${conversation.isPinned ? 'Pinned' : ''}${conversation.isMuted ? ' muted' : ''}`}>{conversation.isPinned ? '📌' : ''}{conversation.isMuted ? ' 🔕' : ''}</span>}
            <div className="flex shrink-0 flex-col items-end gap-1">{conversation.lastMessage?.createdAt && <time className="text-[10px] text-[#E8EFE9]/50" dateTime={conversation.lastMessage.createdAt}>{new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}{conversation.unreadCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-[#D4AF37] text-[10px] font-bold text-[#061F17]">{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</span>}</div>
            {(conversation.isPinned || conversation.isMuted) && <span className="sr-only">{conversation.isPinned ? 'Pinned' : ''}{conversation.isMuted ? ' Muted' : ''}</span>}
            <details className="relative shrink-0"><summary className="grid size-7 cursor-pointer list-none place-items-center rounded-full text-sm text-[#E8EFE9]/65 hover:bg-white/10" aria-label="Conversation options">⋯</summary><div className="absolute right-0 top-8 z-20 min-w-36 rounded-xl border border-white/10 bg-[#0B2A20] p-1 shadow-xl"><button className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10" type="button" onClick={() => onUpdateConversationPreference(conversation.id, 'isPinned', !conversation.isPinned)}>{conversation.isPinned ? 'Unpin chat' : 'Pin chat'}</button><button className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10" type="button" onClick={() => onUpdateConversationPreference(conversation.id, 'isMuted', !conversation.isMuted)}>{conversation.isMuted ? 'Unmute chat' : 'Mute notifications'}</button></div></details>
          </div>;
        })}
      </div>
      {pageError && <p className="mb-3 text-xs leading-5 text-[#F2DFA3]" role="alert">{pageError}</p>}
      <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
        <Avatar src={user?.avatar} name={user?.name} size="size-9" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><p className="truncate text-xs text-[#E8EFE9]/55">{user?.email}</p></div>
        <button className="text-xs text-[#E8EFE9]/70 hover:text-white" disabled={submitting} onClick={onLogout} type="button">Sign out</button>
      </div>
    </aside>
  );
}
