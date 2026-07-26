/**
 * The date filter now lives in `@fatexia/ui` — this file is a re-export so the ten
 * pages that import it keep working unchanged.
 *
 * It moved because the Admin and Affiliate copies were byte-identical, and a preset
 * meaning one span in one portal and another span in the other is a reporting bug
 * nobody would think to look for.
 */
export {
  DateRangeFilter,
  presetRange,
  defaultRange,
  matchPreset,
  toApiRange,
  formatRangeLabel,
  isoDate,
  type DateRange,
  type DateRangeFilterProps,
  type DatePresetId,
} from '@fatexia/ui';
