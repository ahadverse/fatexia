import { ReportView } from '../../components/ReportView';

/**
 * The grouped-report pages. Each is the shared ReportView pinned to the dimension
 * that page is about — the reporting logic, filters and export live in one place
 * (see PLAN-admin.md: one reporting module, not thirteen one-off pages).
 */

export function PerformanceReport() {
  return (
    <ReportView
      title="Performance"
      description="Traffic and revenue by day across the whole network. Use the filters to narrow to one offer, affiliate or advertiser."
      dimension="date"
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
