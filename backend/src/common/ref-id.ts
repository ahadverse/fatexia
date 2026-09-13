import type { ValueTransformer } from 'typeorm';

/**
 * The short numeric id people quote — offer 100042, click 258963.
 *
 * Every table is keyed by a uuid, which is correct for a primary key and unusable in a
 * conversation. `refId` is the human-facing counter that sits alongside it: a display
 * and lookup key, never a foreign key. See migration 1787500000000-NumericRefIds.
 *
 * Postgres returns `bigint` as a string, because the range exceeds what a JS number can
 * hold exactly. Ours cannot get near that ceiling — 2^53 is nine thousand million
 * million clicks — so the transformer hands the rest of the codebase a plain number
 * rather than making every DTO, comparison and template remember to convert.
 */
export const refIdTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | number | null) => (value === null || value === undefined ? value : Number(value)),
};

/**
 * Whether a path or query value is a refId rather than a uuid.
 *
 * The tracker and the postback endpoint both accept either, so links already handed out
 * with a uuid keep working while new ones carry the short number. Digits only, and
 * bounded, so a crafted value cannot reach a query as something exotic.
 */
export function isRefId(value: string): boolean {
  return /^\d{1,18}$/.test(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `AFF-1001`, `MAN-1004` — the sequential display id affiliates and managers are known
// by (migration 1786400000000). Tracking links carry this form, so the tracker has to
// recognise it as an identifier rather than as junk.
const PUBLIC_ID_PATTERN = /^[A-Za-z]{2,6}-\d{1,12}$/;

/**
 * Whether a value is shaped like a `publicId`.
 *
 * Bounded and anchored because it reaches a query from a public endpoint. A value that
 * fails this is not rejected — the click is still recorded, unattributed, which
 * click.entity.ts treats as a signal worth keeping.
 */
export function isPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

/**
 * Whether a value is shaped like a uuid.
 *
 * Checked before a value reaches a `uuid` column, because Postgres raises on a
 * malformed one rather than matching no rows — which would turn a junk identifier on a
 * public endpoint into a 500 instead of the miss it should be.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
