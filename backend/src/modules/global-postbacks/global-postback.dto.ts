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
  /**
   * INBOUND: the real stored secret, returned in full — unlike a third-party
   * `integrations` credential (entered once, only ever used by our own server), this
   * one has to be handed to the advertiser, possibly more than once, so masking it
   * from the admin who owns it only makes it impossible to retrieve. Same rule
   * offers already follow for their own `postbackSecret` (offer.dto.ts).
   */
  secret: string | null;
  allowedIps: string | null;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  /**
   * INBOUND: the address to hand an advertiser, on this deployment's tracker host,
   * with the real secret substituted in — ready to copy-paste, the same way an
   * offer's own postbackUrl already is (see offer.dto.ts's postbackUrlFor).
   *
   * Built here rather than in the admin app, which has no idea what PUBLIC_TRACKING_URL
   * is — the same reason offers and smart-links return their URLs ready-made.
   */
  postbackUrl: string | null;
}

export function toGlobalPostbackDto(row: GlobalPostback): GlobalPostbackDto {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction,
    url: row.url,
    secret: row.secret,
    allowedIps: row.allowedIps,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    // No offerId: a global URL is one address for the whole catalogue, and the caller
    // cannot fill that in — an upstream tracker's offer-id macro is their id, not ours.
    // The click names the offer instead.
    // `sum` carries the sale's revenue — what the advertiser is paying for this
    // conversion. Included in the URL handed out because a parameter nobody is told to
    // send is a parameter nobody sends: percentage payouts and smart-link revenue shares
    // are priced off it, and without it they fall back to the offer's one configured
    // revenue figure for every sale, large or small.
    //
    // Left in even for flat-rate offers, where it changes no payout: it still makes the
    // network's own revenue and margin correct in reporting, and an advertiser who sends
    // it on a flat offer costs nothing.
    postbackUrl:
      row.direction === PostbackDirectionKind.INBOUND && row.secret
        ? `${env.PUBLIC_TRACKING_URL}/postback?click_id={click_id}&secret=${row.secret}&sum={sum}`
        : null,
  };
}
