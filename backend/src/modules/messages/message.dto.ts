import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { managerScopeField } from '../../common/manager-scope-sql';
import { MessageDirection, type Message } from './message.entity';

export const messageFiltersSchema = paginationSchema.extend({
  affiliateId: z.string().uuid().optional(),
  direction: z.nativeEnum(MessageDirection).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export type MessageFiltersDto = z.infer<typeof messageFiltersSchema>;

// Paginates over conversations, not messages.
export const threadFiltersSchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
  // Server-set from the session, never trusted from the query string (issue #5).
  ...managerScopeField,
});

export type ThreadFiltersDto = z.infer<typeof threadFiltersSchema>;

// Admin → affiliate. The direction is fixed by the route, not the payload, so a
// caller can't forge a message as if it came from the affiliate.
export const sendMessageSchema = z.object({
  affiliateId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

// Affiliate → admin: the sender is resolved from the JWT.
export const replyMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type ReplyMessageDto = z.infer<typeof replyMessageSchema>;

export interface MessageDto {
  id: string;
  affiliateId: string;
  affiliateName: string | null;
  direction: MessageDirection;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function toMessageDto(message: Message, affiliateName: string | null = null): MessageDto {
  return {
    id: message.id,
    affiliateId: message.affiliateId,
    affiliateName,
    direction: message.direction,
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

// A conversation summary for the thread list — enough to render a sidebar row
// without loading any of the messages themselves.
export interface MessageThreadDto {
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  lastMessageAt: string;
  lastPreview: string | null;
  lastDirection: MessageDirection | null;
  messageCount: number;
  unreadCount: number;
}

export interface MessageThreadDetailDto {
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  messages: MessageDto[];
}

// Preview text is truncated server-side so the list endpoint doesn't ship a whole
// 5,000-character message body per conversation just to render one line.
export function previewOf(body: string, max = 120): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}
