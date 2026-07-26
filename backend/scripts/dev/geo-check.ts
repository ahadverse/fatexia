// Dev helper: confirms the local MaxMind databases resolve country + ASN, and that
// the datacenter filter fires on hosting ASNs. Run with `npx tsx scripts/dev/geo-check.ts`.
import { geoSource } from '../../src/modules/geo-source/geo-source';
import { isLikelyDatacenter } from '../../src/modules/fraud/datacenter-filter';

const SAMPLES = [
  ['8.8.8.8', 'Google DNS'],
  ['3.5.140.2', 'AWS'],
  ['24.60.1.1', 'Comcast residential'],
  ['1.1.1.1', 'Cloudflare'],
];

(async () => {
  for (const [ip, label] of SAMPLES) {
    const { countryCode, asn } = await geoSource.lookup(ip!);
    console.log(
      `${ip!.padEnd(12)} ${label!.padEnd(22)} country=${countryCode ?? 'null'} asn=${asn ?? 'null'} datacenter=${isLikelyDatacenter(asn)}`,
    );
  }
})();
