import { ReportView } from '../../components/ReportView';

/**
 * The grouped-report pages. Each is the shared ReportView pinned to the dimension
 * that page is about — the reporting logic, filters and export live in one place
 * (see PLAN-admin.md: one reporting module, not thirteen one-off pages).
 */

/**
 * The network's whole picture, unfiltered by default.
 *
 * The grouping is switchable rather than pinned to date. Pinned, the page could only
 * answer "how did the network do that day" — seeing which affiliate or offer was behind
 * a number meant leaving for another report, or narrowing with a filter and losing the
 * overview. Every dimension the tracker captures is one dropdown away, and the filters
 * remain available for when the reader does want to narrow.
 *
 * It opens on 30 days rather than today for the same reason: this is the page someone
 * lands on to see how the network is doing, and a network with no conversions yet today
 * would otherwise greet them with an empty table.
 */
export function PerformanceReport() {
  return (
    <ReportView
      title="Performance"
      description="Everything the network did, across every affiliate, offer and country. Switch the grouping to see who or what is behind a figure; the filters are optional."
      selectableDimensions={['date', 'affiliate', 'offer', 'advertiser', 'country', 'city', 'device', 'os', 'browser']}
      initialPreset="last30"
      showTrend
    />
  );
}

export function OfferReport() {
  return (
    <ReportView
      title="Offer reports"
      description="Every offer's clicks, conversion rate and profit for the selected period."
      dimension="offer"
    />
  );
}

export function AffiliateReport() {
  return (
    <ReportView
      title="Affiliate reports"
      description="Per-affiliate performance — who is sending volume, and what it earns them and the network."
      dimension="affiliate"
    />
  );
}

export function AdvertiserReport() {
  return (
    <ReportView
      title="Advertiser reports"
      description="Performance rolled up per advertiser, across all of their offers."
      dimension="advertiser"
    />
  );
}

export function SubIdReport() {
  return (
    <ReportView
      title="Sub-ID tracking"
      description="Break traffic down by the sub1–sub8 parameters affiliates pass on their tracking links."
      selectableDimensions={['subId1', 'subId2', 'subId3', 'subId4', 'subId5', 'subId6', 'subId7', 'subId8']}
    />
  );
}

export function AdvancedReport() {
  return (
    <ReportView
      title="Advanced reports"
      description="Group by any captured dimension — geo, city, device, OS, browser or sub-ID — with the same filters and export."
      selectableDimensions={[
        'date',
        'offer',
        'affiliate',
        'advertiser',
        'country',
        'city',
        'device',
        'os',
        'browser',
        'subId1',
        'subId2',
        'subId3',
        'subId4',
        'subId5',
        'subId6',
        'subId7',
        'subId8',
      ]}
    />
  );
}

// "Conversion reports" is the aggregate view (how conversions distribute across
// geos); the row-level conversion list is the separate Conversions page.
export function ConversionReport() {
  return (
    <ReportView
      title="Conversion reports"
      description="Where conversions come from. Group by geo, device or offer to see which segments actually convert."
      selectableDimensions={['country', 'city', 'device', 'os', 'browser', 'offer', 'affiliate']}
    />
  );
}
