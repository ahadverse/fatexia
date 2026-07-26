import { useEffect, useState } from 'react';
import { ChatComposer, ChatTranscript, PageHeader, Skeleton, type ChatMessage } from '@fatexia/ui';
import { getOwnThread, markOwnThreadRead, sendOwnMessage } from '../../lib/portal-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { useRealtime } from '../../realtime/RealtimeContext';

/**
 * One conversation: this affiliate and the network.
 *
 * INBOUND rows were written by the affiliate and OUTBOUND by the network, so from
 * this side `mine` is the reverse of the admin portal's. Opening the page marks the
 * network's messages read — the affiliate's own messages are untouched, so this can
 * never clear the admin's unread badge.
 */
export function Messages() {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const { onMessage, onRead, refreshUnread } = useRealtime();
  const thread = useAsync(() => getOwnThread(), []);
  const messages = thread.data?.messages ?? [];

  // Reading the thread is what marks it read, so this is an effect on the loaded
  // data rather than something tied to a click.
  useEffect(() => {
    if (!thread.data) return;
    const hasUnread = thread.data.messages.some((message) => message.direction === 'OUTBOUND' && !message.readAt);
    if (!hasUnread) return;
    void markOwnThreadRead().then(() => {
      thread.reload();
      refreshUnread();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.data]);

  // A message arriving while this page is open refetches the thread. Refetching
  // rather than splicing the payload in keeps one source of truth for the ordering
  // and read flags, and a thread is small enough that the extra request is cheap.
  useEffect(() => {
    const stopMessages = onMessage(() => thread.reload());
    const stopReads = onRead(() => thread.reload());
    return () => {
      stopMessages();
      stopReads();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, onRead]);

  const chatMessages: ChatMessage[] = messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
    mine: message.direction === 'INBOUND',
  }));

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const result = await runAction(() => sendOwnMessage({ body: body.trim() }), {
      success: 'Message sent',
      onDone: thread.reload,
    });
    setSending(false);
    if (result) setBody('');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description="Talk to the network about caps, payouts or offer access. Replies appear here in real time."
      />

      {thread.error && <p className="text-sm text-destructive">{thread.error}</p>}

      <header className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          FX
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-card-foreground">Fatexia support</p>
          <p className="truncate text-xs text-muted-foreground">
            {messages.length === 0
              ? 'No messages yet'
              : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </header>

      {thread.loading ? (
        <Skeleton className="h-[440px] w-full" />
      ) : (
        <ChatTranscript
          messages={chatMessages}
          counterpartName="Fatexia"
          className="h-[440px]"
          emptyState={
            <div className="text-center">
              <p className="text-sm font-medium text-card-foreground">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask about caps, payouts or access to an offer — the team replies here.
              </p>
            </div>
          }
        />
      )}

      <ChatComposer value={body} onChange={setBody} onSend={send} sending={sending} />
    </div>
  );
}
