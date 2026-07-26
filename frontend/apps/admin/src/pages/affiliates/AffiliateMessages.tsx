import { useEffect, useMemo, useState } from 'react';
import {
  ChatComposer,
  ChatTranscript,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  toast,
  type ChatMessage,
} from '@fatexia/ui';
import type { Affiliate } from '@fatexia/types';
import { getMessageThread, getMessageThreads, markThreadRead, sendMessage } from '../../lib/platform-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { useRealtime } from '../../realtime/RealtimeContext';

const PAGE_SIZE = 25;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Sidebar rows show a time for today and a date otherwise — a full timestamp on
// every row is noise when the only question is "how recent is this".
function relativeStamp(iso: string): string {
  const at = new Date(iso);
  const isToday = at.toDateString() === new Date().toDateString();
  return isToday
    ? at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * The network's message inbox.
 *
 * The conversation list is grouped server-side, so it stays complete no matter how
 * many messages exist — it used to be assembled from a single page of raw messages,
 * which quietly dropped whole conversations once the network passed that page size.
 * Opening a thread marks it read in one request rather than one per unread message.
 */
export function AffiliateMessages() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const { onMessage, onRead, refreshUnread } = useRealtime();
  const threads = useAsync(
    () => getMessageThreads({ page, pageSize: PAGE_SIZE, unreadOnly: unreadOnly || undefined }),
    [page, unreadOnly],
  );
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);

  const rows = threads.data?.rows ?? [];

  // Filtering the loaded page client-side: the thread endpoint paginates over
  // conversations and takes no search term, so this narrows what is on screen rather
  // than claiming to search the whole inbox.
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.affiliateName ?? ''} ${row.affiliateEmail ?? ''}`.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const activeId = selectedId ?? visibleRows[0]?.affiliateId ?? null;
  const thread = useAsync(() => (activeId ? getMessageThread(activeId) : Promise.resolve(null)), [activeId]);

  // Live updates. The thread list always refreshes (a message from any affiliate
  // reorders it and moves an unread count); the open conversation only refreshes when
  // the event actually belongs to it, so traffic on other threads doesn't cause the
  // reader's scroll position to jump.
  useEffect(() => {
    const stopMessages = onMessage((payload) => {
      threads.reload();
      if (payload.message.affiliateId === activeId) thread.reload();
    });
    const stopReads = onRead((payload) => {
      threads.reload();
      if (payload.affiliateId === activeId) thread.reload();
    });
    return () => {
      stopMessages();
      stopReads();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, onRead, activeId]);

  // Acknowledge the conversation once its messages are on screen. Marking read is a
  // side effect of viewing, so it belongs in an effect rather than the click handler
  // — that way it also fires for the thread auto-selected on first load.
  useEffect(() => {
    if (!activeId || !thread.data) return;
    const hasUnreadInbound = thread.data.messages.some((message) => message.direction === 'INBOUND' && !message.readAt);
    if (!hasUnreadInbound) return;
    void markThreadRead(activeId).then(() => {
      threads.reload();
      thread.reload();
      refreshUnread();
    });
    // Re-runs only when the loaded conversation changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, thread.data]);

  const composeTarget = composeFor
    ? (affiliates.data ?? []).find((affiliate) => affiliate.id === composeFor)
    : undefined;
  const counterpartName = composeTarget
    ? (composeTarget.fullName ?? composeTarget.email)
    : (thread.data?.affiliateName ?? thread.data?.affiliateEmail ?? 'Affiliate');

  // From the network's side, OUTBOUND is what we wrote.
  const chatMessages: ChatMessage[] = (thread.data?.messages ?? []).map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
    mine: message.direction === 'OUTBOUND',
  }));

  async function send() {
    const affiliateId = composeFor || activeId;
    if (!affiliateId) {
      toast.error('Pick an affiliate to message');
      return;
    }
    if (!body.trim()) return;

    setSending(true);
    const result = await runAction(() => sendMessage({ affiliateId, body: body.trim() }), {
      success: 'Message sent',
      onDone: () => {
        threads.reload();
        thread.reload();
      },
    });
    setSending(false);
    if (result) {
      setBody('');
      setSelectedId(affiliateId);
      setComposeFor('');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Affiliate messages"
        description="Conversations with affiliates. Opening one marks their messages as read on your side only — it never clears their own unread badge."
      />

      {threads.error && <p className="text-sm text-destructive">{threads.error}</p>}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ------------------------------------------------- Conversation list -- */}
        <aside className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by name or email"
              className="h-9"
            />
            <div className="flex items-center gap-2">
              <Select
                value={unreadOnly ? 'unread' : 'all'}
                onChange={(event) => {
                  setUnreadOnly(event.target.value === 'unread');
                  setPage(1);
                }}
                className="h-9 flex-1 text-xs"
              >
                <option value="all">All conversations</option>
                <option value="unread">Unread only</option>
              </Select>
              <Select
                value={composeFor}
                onChange={(event) => setComposeFor(event.target.value)}
                className="h-9 flex-1 text-xs"
                aria-label="Start a new conversation"
              >
                <option value="">New message…</option>
                {(affiliates.data ?? []).map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.fullName ?? affiliate.email}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {threads.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {search
                  ? 'No conversation matches that filter.'
                  : unreadOnly
                    ? 'Every affiliate message has been read.'
                    : 'No conversations yet.'}
              </p>
            ) : (
              <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
                {visibleRows.map((row) => {
                  const name = row.affiliateName ?? row.affiliateEmail ?? row.affiliateId;
                  const active = activeId === row.affiliateId;
                  return (
                    <li key={row.affiliateId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(row.affiliateId);
                          setComposeFor('');
                        }}
                        aria-current={active}
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                          active ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                          {initialsOf(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={`truncate text-sm ${row.unreadCount > 0 ? 'font-semibold text-card-foreground' : 'text-card-foreground'}`}
                            >
                              {name}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {relativeStamp(row.lastMessageAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span
                              className={`truncate text-xs ${row.unreadCount > 0 ? 'text-card-foreground' : 'text-muted-foreground'}`}
                            >
                              {row.lastDirection === 'OUTBOUND' && <span className="mr-1 text-muted-foreground">You:</span>}
                              {row.lastPreview ?? 'No messages'}
                            </span>
                            {row.unreadCount > 0 && (
                              <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                                {row.unreadCount}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={threads.data?.total ?? 0} onPageChange={setPage} />
        </aside>

        {/* ------------------------------------------------------- Conversation -- */}
        <section className="flex flex-col gap-3">
          {!activeId && !composeFor ? (
            <EmptyState
              title="No conversation selected"
              description="Pick a conversation on the left, or start a new one with any affiliate."
            />
          ) : (
            <>
              <header className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initialsOf(counterpartName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-card-foreground">{counterpartName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {composeFor
                      ? 'New conversation'
                      : (thread.data?.affiliateEmail ?? `${chatMessages.length} message${chatMessages.length === 1 ? '' : 's'}`)}
                  </p>
                </div>
              </header>

              {thread.loading ? (
                <Skeleton className="h-[420px] w-full" />
              ) : (
                <ChatTranscript
                  messages={composeFor ? [] : chatMessages}
                  counterpartName={counterpartName}
                  className="h-[420px]"
                  emptyState={
                    <p className="text-center text-sm text-muted-foreground">
                      No messages yet — send the first one below.
                    </p>
                  }
                />
              )}

              <ChatComposer
                value={body}
                onChange={setBody}
                onSend={send}
                sending={sending}
                hint={
                  <>
                    Replying to <span className="text-card-foreground">{counterpartName}</span>
                  </>
                }
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
