import { Fragment, useEffect, useRef, useState } from "react";
import { Avatar } from "../common/Avatar.jsx";
import { HomeLayout } from "../../layouts/HomeLayout.jsx";

export function ConversationPanel({
  selected,
  selectedPerson,
  peerTyping,
  peerOnline,
  peerLastSeen,
  socketReady,
  user,
  pageError,
  messagingBlocked,
  blockedByMe,
  onUnblockPeer,
  messages,
  unreadDivider,
  nextCursor,
  loadingHistory,
  loadOlderMessages,
  readThroughIndex,
  onBack,
  messageText,
  onMessageTextChange,
  sendMessage,
  sending,
  onViewProfile,
  onDeleteMessage,
  failedMessage,
  onRetryFailedMessage,
  onDiscardFailedMessage,
  attachmentDraft,
  attachmentBusy,
  onSelectAttachment,
  onClearAttachment,
  onSendAttachment,
}) {
  return (
    <section
      className={`${selected ? "fixed inset-0 z-20 flex h-dvh min-h-0 bg-[#F3F4F2] p-0 md:relative md:z-auto md:h-full md:p-5 lg:p-6" : "hidden md:flex"} min-w-0 flex-1`}
    >
      {selected && selectedPerson ? (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_30px_rgba(6,31,23,0.06)]">
          <header className="flex min-h-[4.5rem] items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
            <button
              className="grid size-10 shrink-0 place-items-center rounded-full text-lg text-[#1B4332] hover:bg-[#E8EFE9] md:hidden"
              type="button"
              aria-label="Back to chats"
              onClick={onBack}
            >
              ←
            </button>
            <button
              type="button"
              className="rounded-full"
              onClick={() => onViewProfile(selectedPerson.id)}
              aria-label={`View ${selectedPerson.name}'s profile`}
            >
              <Avatar
                src={selectedPerson.avatar}
                name={selectedPerson.name}
                size="size-11"
              />
            </button>
            <button
              className="min-w-0 flex-1 text-left"
              type="button"
              onClick={() => onViewProfile(selectedPerson.id)}
            >
              <h1 className="truncate font-semibold text-[#0F2D1F]">
                {selectedPerson.name}
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-[#68726E]">
                {peerTyping ? (
                  <>
                    <span className="size-1.5 animate-pulse rounded-full bg-[#1B4332]" />
                    Typing…
                  </>
                ) : peerOnline ? (
                  <>
                    <span className="size-1.5 rounded-full bg-[#10B981]" />
                    Online
                  </>
                ) : (
                  lastSeenLabel(peerLastSeen || selectedPerson.lastSeen)
                )}
              </p>
            </button>
          </header>
          {!socketReady && user?.emailVerified && (
            <p
              className="border-b border-[#E9DBA6] bg-[#FFF8DF] px-4 py-2 text-xs text-[#755B06]"
              role="status"
            >
              Reconnecting… Your draft is safe. Messages can still send over the
              API.
            </p>
          )}
          {pageError && (
            <p
              className="mx-4 mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
              role="alert"
            >
              {pageError}
            </p>
          )}
          <ConversationTimeline
            conversationId={selected.id}
            messages={messages}
            unreadDivider={unreadDivider}
            user={user}
            nextCursor={nextCursor}
            loadingHistory={loadingHistory}
            loadOlderMessages={loadOlderMessages}
            readThroughIndex={readThroughIndex}
            selectedPerson={selectedPerson}
            onDeleteMessage={onDeleteMessage}
          />
          {messagingBlocked ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8F8F6] px-4 py-4 sm:px-6">
              <p className="text-sm text-[#68726E]" role="status">
                Messaging is unavailable in this conversation.
              </p>
              {blockedByMe && (
                <button
                  type="button"
                  onClick={onUnblockPeer}
                  className="rounded-lg border border-[#1B4332]/20 bg-white px-4 py-2 text-sm font-semibold text-[#1B4332] hover:bg-[#E8EFE9]"
                >
                  Unblock user
                </button>
              )}
            </div>
          ) : (
            <>
              {failedMessage && (
                <div className="flex items-center gap-3 border-t border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-xs text-[#991B1B]">
                  <span className="min-w-0 flex-1 truncate">
                    Message failed: {failedMessage.error}
                  </span>
                  <button
                    className="font-semibold underline disabled:opacity-50"
                    type="button"
                    onClick={onRetryFailedMessage}
                    disabled={sending}
                  >
                    Retry
                  </button>
                  <button
                    className="font-medium"
                    type="button"
                    onClick={onDiscardFailedMessage}
                  >
                    Discard
                  </button>
                </div>
              )}
              <MessageComposer
                messageText={messageText}
                onMessageTextChange={onMessageTextChange}
                sendMessage={sendMessage}
                sending={sending}
                failedMessage={failedMessage}
                attachmentDraft={attachmentDraft}
                attachmentBusy={attachmentBusy}
                onSelectAttachment={onSelectAttachment}
                onClearAttachment={onClearAttachment}
                onSendAttachment={onSendAttachment}
              />
            </>
          )}
        </div>
      ) : (
        <HomeLayout>
          <div className="max-w-md">
            <span
              className="mx-auto grid size-14 place-items-center rounded-full bg-[#E8EFE9] text-2xl text-[#1B4332]"
              aria-hidden="true"
            >
              ✳
            </span>
            <h1 className="mt-5 font-serif text-3xl text-[#0F2D1F]">
              Welcome to WolfLink
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#68726E]">
              Choose a conversation or search for a person to start a private
              chat.
            </p>
            {pageError && (
              <p className="mt-4 text-sm text-[#B91C1C]" role="alert">
                {pageError}
              </p>
            )}
          </div>
        </HomeLayout>
      )}
    </section>
  );
}

function lastSeenLabel(value) {
  if (!value) return "Offline";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Offline";
  const minutes = Math.floor(
    Math.max(0, Date.now() - timestamp.getTime()) / 60000,
  );
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  if (hours < 48)
    return `Last seen yesterday at ${timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return `Last seen ${timestamp.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function DeliveryMark({ status, isRead }) {
  if (status === "sending")
    return (
      <span
        className="ml-1 inline-block text-[10px] text-white/60"
        role="img"
        aria-label="Sending"
      >
        ◷
      </span>
    );
  if (status === "failed")
    return (
      <span
        className="ml-1 inline-block font-bold text-[10px] text-[#FCA5A5]"
        role="img"
        aria-label="Message failed"
      >
        !
      </span>
    );
  return (
    <span
      className={`ml-1 inline-block text-[11px] font-bold ${isRead ? "text-[#53BDEB]" : "text-white/60"}`}
      role="img"
      aria-label={isRead ? "Read" : "Sent"}
      title={isRead ? "Read" : "Sent"}
    >
      ✓
    </span>
  );
}

function ConversationTimeline({
  conversationId,
  messages,
  unreadDivider,
  user,
  nextCursor,
  loadingHistory,
  loadOlderMessages,
  readThroughIndex,
  selectedPerson,
  onDeleteMessage,
}) {
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const latestMessage = messages[messages.length - 1];
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (!latestMessage) {
      container.scrollTop = container.scrollHeight;
      stickToBottom.current = true;
      return;
    }
    if (latestMessage.senderId === user?.id || stickToBottom.current) {
      requestAnimationFrame(() =>
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" }),
      );
      stickToBottom.current = true;
    }
  }, [conversationId, latestMessage?.id, user?.id]);
  async function copyMessage(message) {
    const text = message.text || message.attachment?.url;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(message.id);
      window.setTimeout(
        () =>
          setCopiedMessageId((current) =>
            current === message.id ? null : current,
          ),
        1400,
      );
    } catch {
      setCopiedMessageId(null);
    }
  }
  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 90;
      }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-[#F8F8F6] px-4 py-5 sm:px-8"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      {nextCursor && (
        <button
          className="mx-auto rounded-full border border-[#1B4332]/20 bg-white px-4 py-2 text-xs font-medium text-[#1B4332] hover:bg-[#E8EFE9] disabled:opacity-50"
          disabled={loadingHistory}
          onClick={loadOlderMessages}
          type="button"
        >
          {loadingHistory ? "Loading…" : "Load older messages"}
        </button>
      )}
      {loadingHistory && !messages.length && (
        <p className="m-auto text-sm text-[#68726E]" role="status">
          Loading messages…
        </p>
      )}
      <div className="mt-auto flex flex-col gap-3">
        {!loadingHistory && !messages.length && (
          <div className="m-auto max-w-sm text-center">
            <span
              className="mx-auto grid size-14 place-items-center rounded-full bg-[#E8EFE9] text-2xl text-[#1B4332]"
              aria-hidden="true"
            >
              ◌
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#1B4332]">
              Private conversation
            </p>
            <h2 className="mt-2 font-serif text-3xl text-[#0F2D1F]">
              Say hello to {selectedPerson.name?.split(" ")[0]}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#68726E]">
              This is the beginning of this conversation.
            </p>
          </div>
        )}
        {messages.map((message, index) => {
          const ownMessage = message.senderId === user?.id;
          return (
            <Fragment key={message.id}>
              {unreadDivider?.messageId === message.id && (
                <div
                  className="flex shrink-0 items-center gap-3 py-2 text-[11px] font-semibold text-[#755B06]"
                  role="separator"
                  aria-label={`${unreadDivider.count} unread messages`}
                >
                  <span className="h-px flex-1 bg-[#D9DDCF]" />
                  <span className="whitespace-nowrap">
                    {unreadDivider.count} unread message
                    {unreadDivider.count === 1 ? "" : "s"}
                  </span>
                  <span className="h-px flex-1 bg-[#D9DDCF]" />
                </div>
              )}
              <div
                className={`relative w-fit min-w-[5rem] max-w-[88%] sm:max-w-[72%] ${ownMessage ? "ml-auto" : "mr-auto"}`}
              >
                {selectedMessageId === message.id &&
                  message.type !== "deleted" && (
                    <div
                      role="toolbar"
                      aria-label="Message actions"
                      className={`absolute bottom-full z-20 mb-2 flex max-w-[min(92vw,22rem)] flex-wrap items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1.5 text-[#24382F] shadow-[0_8px_24px_rgba(6,31,23,0.18)] ${ownMessage ? "right-0" : "left-0"}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => copyMessage(message)}
                        className="rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-[#F3F4F2]"
                      >
                        {copiedMessageId === message.id ? "Copied" : "Copy"}
                      </button>
                      {ownMessage && !message.deliveryStatus && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMessageId(null);
                            onDeleteMessage(message.id);
                          }}
                          className="rounded-lg px-2.5 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FEF2F2]"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedMessageId(null)}
                        className="grid size-8 place-items-center rounded-lg text-base text-[#68726E] hover:bg-[#F3F4F2]"
                        aria-label="Close message actions"
                      >
                        ×
                      </button>
                    </div>
                  )}
                <article
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedMessageId === message.id}
                  aria-label={`Message from ${ownMessage ? "you" : selectedPerson.name}. Tap for message actions.`}
                  onClick={() =>
                    setSelectedMessageId((current) =>
                      current === message.id ? null : message.id,
                    )
                  }
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedMessageId(message.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedMessageId((current) =>
                        current === message.id ? null : message.id,
                      );
                    }
                    if (event.key === "Escape") setSelectedMessageId(null);
                  }}
                  className={`w-full cursor-pointer rounded-2xl px-3 py-2 text-left shadow-sm transition-shadow ${selectedMessageId === message.id ? "ring-2 ring-[#D4AF37]/70" : ""} ${ownMessage ? "bg-[#1B4332] text-white" : "border border-[#E5E7EB] bg-white text-[#1F1F1F]"}`}
                >
                  {message.type === "deleted" ? (
                    <p className="text-sm italic text-white/70">
                      This message was deleted.
                    </p>
                  ) : (
                    <>
                      {message.type === "image" && message.attachment?.url && (
                        <img
                          className="mb-2 max-h-72 max-w-full rounded-lg object-contain"
                          src={message.attachment.url}
                          alt="Image attachment"
                          loading="lazy"
                        />
                      )}
                      {message.text && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-5">
                          {message.text}
                          <time
                            dateTime={message.createdAt}
                            className={`ml-2 inline-block whitespace-nowrap align-baseline text-[10px] leading-4 ${ownMessage ? "text-white/65" : "text-[#68726E]"}`}
                          >
                            {new Date(message.createdAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                            {ownMessage && (
                              <DeliveryMark
                                status={message.deliveryStatus}
                                isRead={
                                  readThroughIndex >= index &&
                                  message.deliveryStatus !== "sending" &&
                                  message.deliveryStatus !== "failed"
                                }
                              />
                            )}
                          </time>
                        </p>
                      )}
                      {!message.text && (
                        <time
                          dateTime={message.createdAt}
                          className={`block text-right text-[10px] ${ownMessage ? "text-white/65" : "text-[#68726E]"}`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {ownMessage && (
                            <DeliveryMark
                              status={message.deliveryStatus}
                              isRead={
                                readThroughIndex >= index &&
                                message.deliveryStatus !== "sending" &&
                                message.deliveryStatus !== "failed"
                              }
                            />
                          )}
                        </time>
                      )}
                    </>
                  )}
                </article>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function MessageComposer({
  messageText,
  onMessageTextChange,
  sendMessage,
  sending,
  failedMessage,
  attachmentDraft,
  attachmentBusy,
  onSelectAttachment,
  onClearAttachment,
  onSendAttachment,
}) {
  const attachmentInput = useRef(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-[#E5E7EB] bg-white p-3 sm:gap-3 sm:px-5 sm:py-4"
      onSubmit={sendMessage}
    >
      {attachmentDraft && (
        <div className="flex basis-full items-center gap-3 rounded-lg bg-[#F3F4F2] px-3 py-2 text-xs text-[#34443C]">
          <span className="min-w-0 flex-1 truncate">
            Image ready: {attachmentDraft.file.name}
          </span>
          <button
            type="button"
            className="font-medium text-[#68726E] hover:text-[#B42318]"
            disabled={attachmentBusy}
            onClick={onClearAttachment}
          >
            Remove
          </button>
        </div>
      )}
      <input
        ref={attachmentInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          onSelectAttachment(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        className="grid size-11 shrink-0 place-items-center rounded-full text-lg text-[#1B4332] hover:bg-[#E8EFE9] disabled:opacity-50"
        type="button"
        aria-label="Attach an image"
        title="Attach an image"
        disabled={sending || attachmentBusy}
        onClick={() => attachmentInput.current?.click()}
      >
        ＋
      </button>
      <label className="sr-only" htmlFor="message-composer">
        Type a message
      </label>
      <textarea
        id="message-composer"
        rows={1}
        className="max-h-32 min-h-11 flex-1 resize-none overflow-y-auto rounded-xl border border-[#DFE4DF] px-4 py-3 text-sm leading-5 text-[#1F1F1F] outline-none transition focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10"
        placeholder="Type a message…"
        aria-describedby="message-composer-hint"
        maxLength={4000}
        value={messageText}
        onChange={(event) => onMessageTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <span id="message-composer-hint" className="sr-only">
        Press Enter to send. Press Shift and Enter for a new line.
      </span>
      {attachmentDraft ? (
        <button
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1B4332] text-lg text-white hover:bg-[#0F2D1F] disabled:opacity-50"
          type="button"
          onClick={onSendAttachment}
          disabled={attachmentBusy || Boolean(failedMessage)}
          aria-label={attachmentBusy ? "Uploading image" : "Send image"}
        >
          {attachmentBusy ? "…" : "➤"}
        </button>
      ) : (
        <button
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1B4332] text-lg text-white hover:bg-[#0F2D1F] disabled:opacity-50"
          disabled={sending || !messageText.trim() || Boolean(failedMessage)}
          type="submit"
          aria-label={sending ? "Sending message" : "Send message"}
        >
          {sending ? "…" : "➤"}
        </button>
      )}
    </form>
  );
}
