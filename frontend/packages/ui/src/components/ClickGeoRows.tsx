import type { ClickGeo } from '@fatexia/types';
import { DrawerRow } from './Drawer';

/**
 * The location block of a click drawer, rendered once for both portals.
 *
 * Shared for the same reason `PayoutMethodFields` is: the two sides show the *same*
 * record, and two implementations would drift on exactly the fields that are easy to
 * forget. Geo has already been lost twice this way — the lookup resolved a city and a
 * region for months while no screen had a row to put them in.
 *
 * Fraud reasoning is deliberately not here. The ASN, the registered country and the
 * proxy traits are network-side only, so the admin drawer renders those itself rather
 * than this component taking a `showFraudSignals` flag that one call site could get
 * wrong.
 */
export function ClickGeoRows({ geo }: { geo: ClickGeo }) {
  // The country resolves or it doesn't, and when it doesn't the pre-composed label is
  // the honest answer ("Local network" / "Unknown") rather than a dash.
  const country = geo.countryName
    ? geo.countryCode
      ? `${geo.countryName} (${geo.countryCode})`
      : geo.countryName
    : (geo.countryCode ?? geo.geoLabel);

  return (
    <>
      <DrawerRow label="Location">{geo.geoLabel}</DrawerRow>
      <DrawerRow label="Country">{country}</DrawerRow>
      <DrawerRow label="Continent">{labelled(geo.continentName, geo.continentCode)}</DrawerRow>
      <DrawerRow label="City">{geo.city ?? '—'}</DrawerRow>
      <DrawerRow label="Region">{labelled(geo.region, geo.regionCode)}</DrawerRow>
      {/* Only shown when MaxMind actually has a second subdivision — most countries
          have one level, and a permanent "—" row would be noise on every click. */}
      {(geo.region2 || geo.region2Code) && (
        <DrawerRow label="District">{labelled(geo.region2, geo.region2Code)}</DrawerRow>
      )}
      <DrawerRow label="Postal code" mono>
        {geo.postalCode ?? '—'}
      </DrawerRow>
      <DrawerRow label="Coordinates" mono>
        {geo.latitude !== null && geo.longitude !== null ? `${geo.latitude}, ${geo.longitude}` : '—'}
      </DrawerRow>
      {/* Rendered next to the coordinates on purpose: 8.8.8.8 resolves to a point in
          Kansas with a 1000km radius, and without this the point reads as a location. */}
      <DrawerRow label="Accuracy">{geo.accuracyRadiusKm !== null ? `± ${geo.accuracyRadiusKm} km` : '—'}</DrawerRow>
      <DrawerRow label="Time zone">{geo.timeZone ?? '—'}</DrawerRow>
      {geo.metroCode !== null && <DrawerRow label="Metro (DMA)">{geo.metroCode}</DrawerRow>}
      {geo.cityGeonameId !== null && (
        <DrawerRow label="GeoName ID" mono>
          {geo.cityGeonameId}
        </DrawerRow>
      )}
    </>
  );
}

/** "Illinois (IL)", or whichever half MaxMind actually resolved. */
function labelled(name: string | null, code: string | null): string {
  if (name && code) return `${name} (${code})`;
  return name ?? code ?? '—';
}
