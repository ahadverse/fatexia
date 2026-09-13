import path from 'node:path';
import { open, type Reader, type CityResponse, type AsnResponse } from 'maxmind';
import { env } from '../../common/env';
import { logger } from '../../common/logger';

/**
 * Everything the GeoLite2 pair actually knows about an address.
 *
 * The lookup reads one record per database whatever we ask of it, so a narrower shape
 * here does not make the click path faster — it only throws information away. It has
 * been narrowed twice before: the first version kept `country.iso_code` alone, which is
 * why no screen could show a city, and the second added city/region and still dropped
 * the postcode, the coordinates, the timezone and the registered country.
 *
 * The one thing deliberately not carried across is MaxMind's localized `names` maps —
 * the same city in eight languages, none of which any screen renders. `geonameId` is
 * kept instead, since that is what a translation would be looked up by.
 */
export interface GeoLookupResult {
  countryCode: string | null;
  /** Country name, English — so a report can render "Bangladesh", not just "BD". */
  countryName: string | null;
  /**
   * Where the address block is *registered*, which is not always where it is used.
   *
   * A US-registered range answering from Germany is ordinary for a VPN and unusual for
   * organic traffic, so the mismatch is a fraud signal in its own right. Network-facing
   * only, like the rest of the fraud reasoning.
   */
  registeredCountryCode: string | null;
  continentCode: string | null;
  continentName: string | null;
  /** City name, English. Null when the IP resolves to a country but no finer. */
  city: string | null;
  /** GeoNames id for the city — the stable handle behind the name. */
  cityGeonameId: number | null;
  /** Subdivision name, e.g. "Illinois". */
  region: string | null;
  /** Subdivision ISO code, e.g. "IL" — what the compact geo label uses. */
  regionCode: string | null;
  /** Second-level subdivision where MaxMind has one (a county, a district). */
  region2: string | null;
  region2Code: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * MaxMind's own confidence, in kilometres.
   *
   * Worth storing next to the coordinates because it is what stops them being
   * over-read: a 1000km radius is the middle of the country, not a location, and
   * 8.8.8.8 returns exactly that.
   */
  accuracyRadiusKm: number | null;
  /** IANA zone, e.g. `America/New_York` — the honest basis for a local-time column. */
  timeZone: string | null;
  /** US metro/DMA code. Null everywhere else. */
  metroCode: number | null;
  /** `7922 Comcast Cable Communications, LLC` — kept whole for the datacenter filter. */
  asn: string | null;
  /** The same thing split, so a report can group or filter on the number itself. */
  asnNumber: number | null;
  asnOrganization: string | null;
  /** MaxMind's own legacy proxy/satellite traits. Rarely set in GeoLite2, free when it is. */
  isAnonymousProxy: boolean | null;
  isSatelliteProvider: boolean | null;
  /** Loopback/RFC1918/link-local. MaxMind has no record for these by design, so this
   *  distinguishes "we know it's a local address" from "lookup failed". */
  isPrivateIp: boolean;
}

const EMPTY_RESULT: Omit<GeoLookupResult, 'isPrivateIp'> = {
  countryCode: null,
  countryName: null,
  registeredCountryCode: null,
  continentCode: null,
  continentName: null,
  city: null,
  cityGeonameId: null,
  region: null,
  regionCode: null,
  region2: null,
  region2Code: null,
  postalCode: null,
  latitude: null,
  longitude: null,
  accuracyRadiusKm: null,
  timeZone: null,
  metroCode: null,
  asn: null,
  asnNumber: null,
  asnOrganization: null,
  isAnonymousProxy: null,
  isSatelliteProvider: null,
};

let cityReader: Reader<CityResponse> | null = null;
let asnReader: Reader<AsnResponse> | null = null;
let initialized = false;

/**
 * Express reports IPv4 clients as IPv4-mapped IPv6 (`::ffff:127.0.0.1`) whenever the
 * listening socket is dual-stack, which is the default. MaxMind will not match that
 * form, so the prefix has to come off before any lookup or private-range test.
 */
export function normalizeIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed || trimmed === 'unknown') return null;
  return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
}

/** Ranges MaxMind deliberately has no record for. Checked so the UI can say "Local
 *  network" instead of a bare dash — which is what a dev machine always produces. */
export function isPrivateOrLoopback(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true;
  // Unique-local (fc00::/7) and IPv6 link-local.
  if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return true;

  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const [a, b] = parts.map((part) => Number(part));
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return false;

  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

// MaxMind's GeoLite2 .mmdb files require a free account (see .env). Missing
// files are expected on a fresh checkout — this degrades to "unknown" geo/ASN rather
// than crashing the click hot path, so the Tracker is usable before that setup step.
async function openReaders(): Promise<void> {
  try {
    cityReader = await open<CityResponse>(path.join(env.GEOIP_DB_DIR, 'GeoLite2-City.mmdb'));
  } catch {
    cityReader = null;
    logger.warn(`GeoLite2-City.mmdb not found in ${env.GEOIP_DB_DIR} — country lookups disabled`);
  }

  try {
    asnReader = await open<AsnResponse>(path.join(env.GEOIP_DB_DIR, 'GeoLite2-ASN.mmdb'));
  } catch {
    asnReader = null;
    logger.warn(`GeoLite2-ASN.mmdb not found in ${env.GEOIP_DB_DIR} — ASN lookups disabled`);
  }
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await openReaders();
}

// `open()` reads the file into memory once — a background refetch (see
// infra/geoip/ensure-geoip.ts) that replaces the .mmdb files on disk would otherwise
// go completely unnoticed, still serving whatever was loaded at first use (or staying
// permanently disabled if no file existed yet at that point). Called after every
// refetch attempt so a first-time-successful download also takes effect immediately,
// without waiting for the next click to trigger the lazy path above.
export async function reloadGeoipReaders(): Promise<void> {
  initialized = true;
  await openReaders();
}

export const geoSource = {
  /**
   * City-level lookup. The City database was already open — the previous version read
   * only `country.iso_code` from it and discarded the rest, which is why the UI had no
   * city or region to show.
   *
   * Never throws: `Reader.get()` raises on a malformed address, and the tracker calls
   * this with whatever the socket reported, so an unparseable value must degrade to
   * "unknown" rather than 500 a redirect that should have happened.
   */
  async lookup(ip: string): Promise<GeoLookupResult> {
    await ensureInitialized();

    const normalized = normalizeIp(ip);
    if (!normalized) return { ...EMPTY_RESULT, isPrivateIp: false };

    const isPrivateIp = isPrivateOrLoopback(normalized);
    // Skip the lookup entirely for private space — it can only miss, and the caller
    // needs the flag, not a null country it can't interpret.
    if (isPrivateIp) return { ...EMPTY_RESULT, isPrivateIp: true };

    let city: CityResponse | null | undefined;
    try {
      city = cityReader?.get(normalized);
    } catch (err) {
      logger.warn({ err, ip: normalized }, 'City lookup failed');
    }

    let asnRecord: AsnResponse | null | undefined;
    try {
      asnRecord = asnReader?.get(normalized);
    } catch (err) {
      logger.warn({ err, ip: normalized }, 'ASN lookup failed');
    }

    // MaxMind orders subdivisions largest-first: [state, county] in the US, and often
    // just the one. The second is absent far more often than not.
    const subdivision = city?.subdivisions?.[0];
    const subdivision2 = city?.subdivisions?.[1];
    const location = city?.location;
    // GeoLite2 populates these only sometimes, and the typings make them optional, so
    // an absent trait has to stay null rather than collapse to a confident `false`.
    const traits = city?.traits as { is_anonymous_proxy?: boolean; is_satellite_provider?: boolean } | undefined;
    const asnNumber = asnRecord?.autonomous_system_number ?? null;
    const asnOrganization = asnRecord?.autonomous_system_organization ?? null;

    return {
      countryCode: city?.country?.iso_code ?? null,
      countryName: city?.country?.names?.en ?? null,
      registeredCountryCode: city?.registered_country?.iso_code ?? null,
      continentCode: city?.continent?.code ?? null,
      continentName: city?.continent?.names?.en ?? null,
      city: city?.city?.names?.en ?? null,
      cityGeonameId: city?.city?.geoname_id ?? null,
      region: subdivision?.names?.en ?? null,
      regionCode: subdivision?.iso_code ?? null,
      region2: subdivision2?.names?.en ?? null,
      region2Code: subdivision2?.iso_code ?? null,
      postalCode: city?.postal?.code ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracyRadiusKm: location?.accuracy_radius ?? null,
      timeZone: location?.time_zone ?? null,
      metroCode: location?.metro_code ?? null,
      // Kept as the combined string the datacenter filter already keyword-matches on.
      asn: asnNumber || asnOrganization ? `${asnNumber ?? ''} ${asnOrganization ?? ''}`.trim() || null : null,
      asnNumber,
      asnOrganization,
      isAnonymousProxy: traits?.is_anonymous_proxy ?? null,
      isSatelliteProvider: traits?.is_satellite_provider ?? null,
      isPrivateIp: false,
    };
  },
};
