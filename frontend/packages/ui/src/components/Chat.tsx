'use client';

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check, CheckCheck, SendHorizontal } from 'lucide-react';
import { cn } from '../lib/cn';

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** True for messages written by whoever is looking at the screen. */
  mine: boolean;
}

// Consecutive messages from the same side inside this window render as one run:
// no repeated author line, tighter spacing. Long enough that a normal back-and-forth
// groups, short enough that a reply hours later still reads as a new turn.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function dayLabel(value: Date): string {
  const today = startOfDay(new Date());
  const day = startOfDay(value);
  if (day === today) return 'Today';
  if (day === today - 86_400_000) return 'Yesterday';
  return value.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    // The year only earns its space once it is ambiguous.
    ...(value.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

function timeLabel(value: Date): string {
  return value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export interface ChatTranscriptProps {
  messages: ChatMessage[];
  /** Name shown against the other party's runs. */
  counterpartName: string;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * A conversation transcript.
 *
 * Shared rather than written per portal because the two sides render the *same*
 * conversation mirrored — what is `mine` on one side is the counterpart's on the
 * other. Two implementations would inevitably drift on the details that matter
 * (grouping, read receipts, day boundaries) and disagree about the same thread.
 */
export function ChatTranscript({ messages, counterpartName, emptyState, className }: ChatTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;

  // Pinned to the newest message — a chat that opens at the top makes the reader
  // scroll to find what they came for. Layout effect so it lands before paint
  // instead of visibly jumping.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lastId]);

  if (messages.length === 0) {
    return <div className={cn('rounded-lg border border-border bg-card p-8', className)}>{emptyState}</div>;
  }

  return (
    <div ref={scrollRef} className={cn('overflow-y-auto rounded-lg border border-border bg-card px-4 py-3', className)}>
      {messages.map((message, index) => {
        const at = new Date(message.createdAt);
        const previous = messages[index - 1];
        const previousAt = previous ? new Date(previous.createdAt) : null;

        const newDay = !previousAt || startOfDay(previousAt) !== startOfDay(at);
        const grouped =
          !newDay &&
          !!previous &&
          previous.mine === message.mine &&
          at.getTime() - (previousAt?.getTime() ?? 0) < GROUP_WINDOW_MS;

        // The author line goes on the *first* message of a run; the receipt goes on
        // the last, so a run of five messages doesn't repeat either five times.
        const next = messages[index + 1];
        const endsRun =
          !next ||
          next.mine !== message.mine ||
          new Date(next.createdAt).getTime() - at.getTime() >= GROUP_WINDOW_MS ||
          startOfDay(new Date(next.createdAt)) !== startOfDay(at);

        return (
          <div key={message.id}>
            {newDay && (
              <div className="my-4 flex items-center gap-3 first:mt-0">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {dayLabel(at)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className={cn('flex flex-col', grouped ? 'mt-0.5' : 'mt-3', message.mine ? 'items-end' : 'items-start')}>
              {!grouped && (
                <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                  {message.mine ? 'You' : counterpartName}
                </span>
              )}

              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                  message.mine
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-foreground',
                  // Squaring the inner corner of a run is what makes consecutive
                  // bubbles read as one turn rather than several.
                  message.mine ? (grouped ? 'rounded-tr-md' : '') : grouped ? 'rounded-tl-md' : '',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>

              {endsRun && (
                <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                  {timeLabel(at)}
                  {message.mine &&
                    (message.readAt ? (
                      <>
                        <CheckCheck className="size-3" aria-hidden />
                        <span className="sr-only">Read</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3" aria-hidden />
                        <span className="sr-only">Delivered</span>
                      </>
                    ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Small line above the input — who the message is going to, usually. */
  hint?: ReactNode;
}

const MAX_COMPOSER_HEIGHT = 160;

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  placeholder = 'Write a message…',
  hint,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !sending && !disabled && value.trim().length > 0;

  // Grows with the message up to a cap, then scrolls — a fixed 4-row box wastes
  // space on one-liners and hides the end of anything longer.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter (and IME composition) still insert a newline.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {hint && <div className="mb-2 px-1 text-xs text-muted-foreground">{hint}</div>}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}
