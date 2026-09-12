import { z } from 'zod';
import { env } from '../../common/env';
import { PostbackDirectionKind, type GlobalPostback } from './global-postback.entity';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

export const createGlobalPostbackSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    direction: z.nativeEnum(PostbackDirectionKind),
    url: optionalText(1000),
    secret: optionalText(255),
    allowedIps: optionalText(500),
    enabled: z.boolean().default(true),
  })
  // Each direction has one field it cannot work without, and accepting an entry that
  // lacks it would create a row that silently never fires or never authorises anything.
  .refine((dto) => dto.direction !== PostbackDirectionKind.OUTBOUND || !!dto.url, {
    message: 'An outbound postback needs a URL',
    path: ['url'],
  })
  .refine((dto) => dto.direction !== PostbackDirectionKind.INBOUND || !!dto.secret, {
    message: 'An inbound postback needs a secret',
    path: ['secret'],
  });

export type CreateGlobalPostbackDto = z.infer<typeof createGlobalPostbackSchema>;

// Direction is fixed at creation: flipping it would leave the row carrying the other
// direction's fields, which is a different postback wearing the same id.
export const updateGlobalPostbackSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  url: optionalText(1000),
  secret: optionalText(255),
  allowedIps: optionalText(500),
  enabled: z.boolean().optional(),
});

export type UpdateGlobalPostbackDto = z.infer<typeof updateGlobalPostbackSchema>;

export interface GlobalPostbackDto {
  id: string;
  name: string;
  direction: PostbackDirectionKind;
  url: string | null;
  /** Masked. The raw secret is never returned once stored — same rule as integrations. */
  secretPreview: string | null;
  hasSecret: boolean;
  allowedIps: string | null;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  /**
   * INBOUND: the address to hand an advertiser, on this deployment's tracker host.
   *
   * Built here rather than in the admin app, which has no idea what PUBLIC_TRACKING_URL
   * is — the same reason offers and smart-links return their URLs ready-made. The
   * secret is left as a placeholder because it is never returned once stored.
   */
  postbackUrl: string | null;
}

function mask(secret: string | null): string | null {
  if (!secret) return null;
  return `••••${secret.slice(-4)}`;
}

export function toGlobalPostbackDto(row: GlobalPostback): GlobalPostbackDto {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction,
    url: row.url,
    secretPreview: mask(row.secret),
    hasSecret: !!row.secret,
    allowedIps: row.allowedIps,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    // No offerId: a global URL is one address for the whole catalogue, and the caller
    // cannot fill that in — an upstream tracker's offer-id macro is their id, not ours.
    // The click names the offer instead.
    postbackUrl:
      row.direction === PostbackDirectionKind.INBOUND
        ? `${env.PUBLIC_TRACKING_URL}/postback?click_id={click_id}&secret=<secret>`
        : null,
  };
}
