// Baseline, zero-cost datacenter/hosting detection: match the ASN organization name
// against known hosting-provider keywords. This is the "Step 1" layer from
// PLAN-tracker.md — cheap and effective against low-tier bots, but a blunt
// instrument (string matching, not a curated ASN-number list). A maintained static
// ASN blocklist (e.g. X4BNet's lists) is a stronger follow-up; this keyword list is
// the $0 starting point that works with no external file at all.
const HOSTING_KEYWORDS = [
  'amazon',
  'aws',
  'google cloud',
  'microsoft azure',
  'digitalocean',
  'linode',
  'akamai',
  'vultr',
  'choopa',
  'hetzner',
  'ovh',
  'contabo',
  'scaleway',
  'oracle cloud',
  'alibaba',
  'tencent',
  'hosting',
  'datacenter',
  'data center',
  'colocation',
  'vps',
  'server',
];

export function isLikelyDatacenter(asn: string | null): boolean {
  if (!asn) return false;
  const normalized = asn.toLowerCase();
  return HOSTING_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
