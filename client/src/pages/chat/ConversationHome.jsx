import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice.js';
import { api, getApiMessage } from '../../lib/api.js';
import { chatSocket } from '../../lib/socket.js';
import { ChatSidebar } from '../../components/chat/ChatSidebar.jsx';
import { ConversationPanel } from '../../components/chat/ConversationPanel.jsx';
import { PublicProfileDialog } from '../../components/chat/PublicProfileDialog.jsx';
import { ChatLayout } from '../../layouts/ChatLayout.jsx';
import { toast } from 'sonner';

export function ConversationHome() {
  const dispatch = useDispatch();
  const { user, submitting, error } = useSelector((state) => state.auth);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selected, setSelected] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadDivider, setUnreadDivider] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [failedMessage, setFailedMessage] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [socketReady, setSocketReady] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerReadMessageId, setPeerReadMessageId] = useState(null);
  const typingTimer = useRef(null);
  const conversationsRef = useRef(conversations);
  const selectedRef = useRef(selected);
  conversationsRef.current = conversations;
  selectedRef.current = selected;

  async function loadConversations() {
    if (!user?.emailVerified) return;
    setLoadingConversations(true);
    try {
      const response = await api.get('/conversations');
      const nextConversations = response.data.data.conversations;
      setConversations(nextConversations);
      setSelected((current) => {
        if (!current) return current;
        const updated = nextConversations.find((item) => item.id === current.id);
        return updated ? { ...current, ...updated } : null;
      });
    } catch (reason) {
      setPageError(getApiMessage(reason));
      toast.error(getApiMessage(reason));
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => { loadConversations(); }, [user?.id, user?.emailVerified]);

  useEffect(() => {
    const value = query.trim();
    const controller = new AbortController();
    setResults([]);
    setSearchError('');
    if (!value || !user?.emailVerified) {
      setSearching(false);
      return () => controller.abort();
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const params = value.startsWith('+') ? { phone: value } : { q: value };
      try {
        const response = await api.get('/users/search', { params, signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(response.data.data.users);
        if (!response.data.data.users.length) setSearchError('No verified people found. Try a username, name, or public phone number.');
      } catch (reason) {
        if (!controller.signal.aborted) setSearchError(getApiMessage(reason));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, user?.emailVerified]);

  useEffect(() => {
    if (!user?.emailVerified) {
      chatSocket.disconnect();
      setSocketReady(false);
      return undefined;
    }
    const onConnect = () => setSocketReady(true);
    const onDisconnect = () => setSocketReady(false);
    const onConnectError = (error) => {
      if (error.message === 'UNAUTHENTICATED') api.post('/auth/refresh').then(() => chatSocket.connect()).catch(() => {});
    };
    const onNotification = (message) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || localStorage.getItem('wolflink:notifications') !== 'true') return;
      const conversation = conversationsRef.current.find((item) => item.id === message.conversationId);
      if (!conversation || conversation.isMuted || (!document.hidden && selectedRef.current?.id === message.conversationId)) return;
      const sender = conversation.participants.find((person) => person.id === message.senderId);
      const body = message.type === 'image' ? (message.text ? `Photo: ${message.text}` : 'Sent a photo') : message.text;
      const notice = new Notification(sender?.name || 'New WolfLink message', { body: body || 'You have a new message.', icon: sender?.avatar || undefined, tag: `wolflink:${conversation.id}`, silent: true });
      notice.onclick = () => {
        window.focus();
        void selectConversation(conversation);
        notice.close();
      };
      loadConversations();
    };
    chatSocket.on('connect', onConnect);
    chatSocket.on('disconnect', onDisconnect);
    chatSocket.on('connect_error', onConnectError);
    chatSocket.on('message:notification', onNotification);
    chatSocket.connect();
    return () => {
      chatSocket.off('connect', onConnect);
      chatSocket.off('disconnect', onDisconnect);
      chatSocket.off('connect_error', onConnectError);
      chatSocket.off('message:notification', onNotification);
      chatSocket.disconnect();
    };
  }, [user?.id, user?.emailVerified]);

  useEffect(() => {
    if (!socketReady || !selected?.id) return undefined;
    let active = true;
    const conversationId = selected.id;
    setPeerOnline(false);
    setPeerLastSeen(selectedPerson?.lastSeen || null);
    const onMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        const pendingIndex = current.findIndex((item) => item.clientMessageId && item.clientMessageId === message.clientMessageId);
        if (pendingIndex >= 0) return current.map((item, index) => index === pendingIndex ? message : item);
        return [...current, message];
      });
      loadConversations();
    };
    const onMessageUpdate = (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
      loadConversations();
    };
    const onTyping = (event) => {
      if (event.conversationId === conversationId && event.userId === selectedPerson?.id) setPeerTyping(event.isTyping);
    };
    const onPresence = (event) => {
      if (event.userId === selectedPerson?.id) {
        setPeerOnline(event.isOnline);
        setPeerLastSeen(event.lastSeen || null);
      }
    };
    const onRead = (event) => {
      if (event.conversationId === conversationId && event.userId === selectedPerson?.id) setPeerReadMessageId(event.lastReadMessageId);
    };
    const onBlockUpdate = (event) => {
      if (![user?.id, selectedPerson?.id].includes(event.blockedById) && ![user?.id, selectedPerson?.id].includes(event.blockedUserId)) return;
      api.get(`/conversations/${conversationId}`).then((response) => {
        if (!active) return;
        setSelected((current) => current?.id === conversationId ? { ...current, ...response.data.data.conversation } : current);
        setPeerReadMessageId(response.data.data.conversation.peerLastReadMessageId || null);
      }).catch(() => {});
      loadConversations();
    };
    chatSocket.on('message:new', onMessage);
    chatSocket.on('message:update', onMessageUpdate);
    chatSocket.on('typing:update', onTyping);
    chatSocket.on('presence:update', onPresence);
    chatSocket.on('message:read', onRead);
    chatSocket.on('block:update', onBlockUpdate);
    chatSocket.emit('conversation:join', { conversationId }, (result) => {
      if (!active || !result?.ok) return;
      if (result.presence) {
        setPeerOnline(result.presence.isOnline);
        setPeerLastSeen(result.presence.lastSeen || selectedPerson?.lastSeen || null);
      }
      api.get(`/conversations/${conversationId}/messages`).then((response) => {
        if (!active) return;
        setMessages((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of response.data.data.messages) byId.set(item.id, item);
          return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }).catch(() => {});
    });
    return () => {
      active = false;
      clearTimeout(typingTimer.current);
      chatSocket.emit('typing:update', { conversationId, isTyping: false });
      chatSocket.emit('conversation:leave', { conversationId });
      chatSocket.off('message:new', onMessage);
      chatSocket.off('message:update', onMessageUpdate);
      chatSocket.off('typing:update', onTyping);
      chatSocket.off('presence:update', onPresence);
      chatSocket.off('message:read', onRead);
      chatSocket.off('block:update', onBlockUpdate);
      setPeerTyping(false);
      setPeerReadMessageId(null);
    };
  }, [socketReady, selected?.id]);

  useEffect(() => {
    let active = true;
    if (!selected?.id) {
      setMessages([]);
      setNextCursor(null);
      return () => { active = false; };
    }
    setMessages([]);
    setUnreadDivider(null);
    setNextCursor(null);
    setLoadingHistory(true);
    api.get(`/conversations/${selected.id}/messages`)
      .then(async (response) => {
        if (!active) return;
        const historyMessages = response.data.data.messages;
        const readMarkerIndex = selected.lastReadMessageId ? historyMessages.findIndex((item) => item.id === selected.lastReadMessageId) : -1;
        const unreadMessages = historyMessages.slice(readMarkerIndex + 1).filter((item) => item.senderId !== user?.id);
        if (unreadMessages.length) setUnreadDivider({ messageId: unreadMessages[0].id, count: selected.unreadCount || unreadMessages.length });
        setMessages((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of historyMessages) byId.set(item.id, item);
          return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        setNextCursor(response.data.data.nextCursor);
        await api.post(`/conversations/${selected.id}/read`, { lastReadMessageId: response.data.data.messages.at(-1)?.id });
        await loadConversations();
      })
      .catch((reason) => { if (active) setPageError(getApiMessage(reason)); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [selected?.id]);

  async function openConversation(userId) {
    setBusy(true);
    setPageError('');
    try {
      const response = await api.post('/conversations', { userId });
      const conversation = response.data.data.conversation;
      setSelected({ ...conversation, unreadCount: conversations.find((item) => item.id === conversation.id)?.unreadCount || 0 });
      setPeerReadMessageId(conversation.peerLastReadMessageId || null);
      setResults([]);
      setQuery('');
      await loadConversations();
    } catch (reason) {
      setPageError(getApiMessage(reason));
      toast.error(getApiMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectConversation(conversation) {
    setPageError('');
    try {
      const response = await api.get(`/conversations/${conversation.id}`);
      setSelected({ ...response.data.data.conversation, unreadCount: conversation.unreadCount || 0 });
      setPeerReadMessageId(response.data.data.conversation.peerLastReadMessageId || null);
    } catch (reason) {
      setPageError(getApiMessage(reason));
      toast.error(getApiMessage(reason));
    }
  }

  async function loadOlderMessages() {
    if (!selected?.id || !nextCursor || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const response = await api.get(`/conversations/${selected.id}/messages`, { params: { before: nextCursor } });
      setMessages((current) => [...response.data.data.messages, ...current]);
      setNextCursor(response.data.data.nextCursor);
    } catch (reason) {
      setPageError(getApiMessage(reason));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function deliverMessage(payload) {
    if (!selected?.id || sending) return;
    setSending(true);
    setPageError('');
    const pendingId = `pending:${payload.clientMessageId}`;
    setMessages((current) => current.some((item) => item.clientMessageId === payload.clientMessageId)
      ? current.map((item) => item.clientMessageId === payload.clientMessageId ? { ...item, deliveryStatus: 'sending' } : item)
      : [...current, { id: pendingId, conversationId: selected.id, senderId: user.id, clientMessageId: payload.clientMessageId, type: 'text', text: payload.text, createdAt: new Date().toISOString(), deliveryStatus: 'sending' }]);
    let message;
    try {
      if (socketReady) {
        const result = await new Promise((resolve) => chatSocket.timeout(10000).emit('message:send', { ...payload, conversationId: selected.id }, (error, value) => resolve(error ? null : value)));
        if (result?.ok) message = result.message;
        else if (result) throw new Error(result.error?.message || 'Message could not be sent. Please retry.');
        else {
          // Reuse the same idempotency key if the socket acknowledgement was lost after persistence.
          const response = await api.post(`/conversations/${selected.id}/messages`, payload);
          message = response.data.data.message;
        }
      } else {
        const response = await api.post(`/conversations/${selected.id}/messages`, payload);
        message = response.data.data.message;
      }
    } catch (reason) {
      const errorMessage = reason.response ? getApiMessage(reason) : reason.message || getApiMessage(reason);
      setPageError(errorMessage);
      setFailedMessage({ ...payload, error: errorMessage });
      setMessages((current) => current.map((item) => item.clientMessageId === payload.clientMessageId ? { ...item, deliveryStatus: 'failed' } : item));
      toast.error(errorMessage);
      setSending(false);
      return;
    } finally {
      setSending(false);
    }
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current.filter((item) => item.clientMessageId !== payload.clientMessageId || item.id === message.id);
      const pendingIndex = current.findIndex((item) => item.clientMessageId === payload.clientMessageId);
      return pendingIndex < 0 ? [...current, message] : current.map((item, index) => index === pendingIndex ? message : item);
    });
    setMessageText((current) => current.trim() === payload.text ? '' : current);
    setFailedMessage(null);
    clearTimeout(typingTimer.current);
    if (socketReady) chatSocket.emit('typing:update', { conversationId: selected.id, isTyping: false });
    api.post(`/conversations/${selected.id}/read`, { lastReadMessageId: message.id }).catch(() => {});
    loadConversations();
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = messageText.trim();
    if (!selected?.id || !text || sending) return;
    if (failedMessage) {
      if (failedMessage.text !== text) toast.error('Retry or discard the failed message before sending a new one.');
      else deliverMessage(failedMessage);
      return;
    }
    deliverMessage({ text, clientMessageId: crypto.randomUUID() });
  }

  function discardFailedMessage() {
    if (failedMessage?.text === messageText.trim()) setMessageText('');
    if (failedMessage) setMessages((current) => current.filter((item) => item.clientMessageId !== failedMessage.clientMessageId));
    setFailedMessage(null);
  }

  function retryFailedMessage() {
    if (failedMessage && !sending) deliverMessage(failedMessage);
  }

  function selectAttachment(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Choose a JPG, PNG, or WebP image.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Choose an image smaller than 10 MB.'); return; }
    setAttachmentDraft({ file, clientMessageId: crypto.randomUUID() });
  }

  async function sendAttachment() {
    if (!attachmentDraft || attachmentBusy || !selected?.id) return;
    setAttachmentBusy(true);
    try {
      const params = new URLSearchParams({ clientMessageId: attachmentDraft.clientMessageId, caption: messageText.trim() });
      const response = await api.post(`/conversations/${selected.id}/attachments?${params}`, attachmentDraft.file, { headers: { 'Content-Type': attachmentDraft.file.type } });
      setMessages((current) => current.some((item) => item.id === response.data.data.message.id) ? current : [...current, response.data.data.message]);
      setAttachmentDraft(null); setMessageText(''); await loadConversations();
      toast.success('Image sent');
    } catch (reason) { toast.error(getApiMessage(reason)); }
    finally { setAttachmentBusy(false); }
  }

  async function deleteMessage(messageId) {
    if (!window.confirm('Delete this message for everyone in this conversation?')) return;
    try {
      const response = await api.delete(`/conversations/${selected.id}/messages/${messageId}`);
      setMessages((current) => current.map((item) => item.id === messageId ? response.data.data.message : item));
      toast.success('Message deleted');
    } catch (reason) { toast.error(getApiMessage(reason)); }
  }

  async function unblockSelectedPeer() {
    if (!selectedPerson || !selected?.blockedByMe) return;
    try {
      await api.delete(`/users/${selectedPerson.id}/block`);
      const response = await api.get(`/conversations/${selected.id}`);
      setSelected((current) => current?.id === selected.id ? { ...current, ...response.data.data.conversation } : current);
      await loadConversations();
      toast.success('User unblocked. You can message again.');
    } catch (reason) { toast.error(getApiMessage(reason)); }
  }

  async function updateConversationPreference(conversationId, key, value) {
    try {
      const response = await api.patch(`/conversations/${conversationId}/preferences`, { [key]: value });
      setSelected((current) => current?.id === conversationId ? { ...current, ...response.data.data.conversation } : current);
      await loadConversations();
      toast.success(key === 'isPinned' ? (value ? 'Chat pinned' : 'Chat unpinned') : (value ? 'Chat muted' : 'Chat unmuted'));
    } catch (reason) { toast.error(getApiMessage(reason)); }
  }

  const selectedPerson = selected?.participants?.find((person) => person.id !== user?.id);
  const readThroughIndex = peerReadMessageId ? messages.findIndex((item) => item.id === peerReadMessageId) : -1;
  function updateMessageText(value) {
    setMessageText(value);
    if (socketReady && selected?.id) {
      const isTyping = Boolean(value.trim());
      chatSocket.emit('typing:update', { conversationId: selected.id, isTyping });
      clearTimeout(typingTimer.current);
      if (isTyping) typingTimer.current = setTimeout(() => chatSocket.emit('typing:update', { conversationId: selected.id, isTyping: false }), 1400);
    }
  }

  return <ChatLayout>
    <ChatSidebar
      user={user}
      submitting={submitting}
      conversations={conversations}
      loadingConversations={loadingConversations}
      selected={selected}
      selectConversation={selectConversation}
      query={query}
      setQuery={setQuery}
      searching={searching}
      searchError={searchError}
      results={results}
      busy={busy}
      openConversation={openConversation}
      pageError={pageError}
      onLogout={() => dispatch(logout())}
      onViewProfile={setProfileId}
      onUpdateConversationPreference={updateConversationPreference}
    />
    <ConversationPanel
      selected={selected}
      selectedPerson={selectedPerson}
      messagingBlocked={selected?.messagingBlocked}
      blockedByMe={selected?.blockedByMe}
      onUnblockPeer={unblockSelectedPeer}
      peerTyping={peerTyping}
      peerOnline={peerOnline}
      peerLastSeen={peerLastSeen}
      socketReady={socketReady}
      user={user}
      pageError={pageError}
      messages={messages}
      unreadDivider={unreadDivider}
      failedMessage={failedMessage}
      attachmentDraft={attachmentDraft}
      attachmentBusy={attachmentBusy}
      onSelectAttachment={selectAttachment}
      onClearAttachment={() => setAttachmentDraft(null)}
      onSendAttachment={sendAttachment}
      onRetryFailedMessage={retryFailedMessage}
      onDiscardFailedMessage={discardFailedMessage}
      onDeleteMessage={deleteMessage}
      nextCursor={nextCursor}
      loadingHistory={loadingHistory}
      loadOlderMessages={loadOlderMessages}
      readThroughIndex={readThroughIndex}
      onBack={() => setSelected(null)}
      messageText={messageText}
      onMessageTextChange={updateMessageText}
      sendMessage={sendMessage}
      sending={sending}
      onViewProfile={setProfileId}
    />
    {profileId && <PublicProfileDialog userId={profileId} onClose={() => setProfileId(null)} onBlockChanged={loadConversations} onMessage={(id) => { setProfileId(null); openConversation(id); }} />}
  </ChatLayout>;
}

