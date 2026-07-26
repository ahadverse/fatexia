import path from 'node:path';
import { open, type Reader, type CityResponse, type AsnResponse } from 'maxmind';
import { env } from '../../common/env';
import { logger } from '../../common/logger';

export interface GeoLookupResult {
  countryCode: string | null;
  /** City name, English. Null when the IP resolves to a country but no finer. */
  city: string | null;
  /** Subdivision name, e.g. "Illinois". */
  region: string | null;
  /** Subdivision ISO code, e.g. "IL" — what the compact geo label uses. */
  regionCode: string | null;
  asn: string | null;
  /** Loopback/RFC1918/link-local. MaxMind has no record for these by design, so this
   *  distinguishes "we know it's a local address" from "lookup failed". */
  isPrivateIp: boolean;
}

const EMPTY_RESULT: Omit<GeoLookupResult, 'isPrivateIp'> = {
  countryCode: null,
  city: null,
  region: null,
  regionCode: null,
  asn: null,
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

// MaxMind's GeoLite2 .mmdb files require a free account (see .env.example). Missing
// files are expected on a fresh checkout — this degrades to "unknown" geo/ASN rather
// than crashing the click hot path, so the Tracker is usable before that setup step.
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    cityReader = await open<CityResponse>(path.join(env.GEOIP_DB_DIR, 'GeoLite2-City.mmdb'));
  } catch {
    logger.warn(`GeoLite2-City.mmdb not found in ${env.GEOIP_DB_DIR} — country lookups disabled`);
  }

  try {
    asnReader = await open<AsnResponse>(path.join(env.GEOIP_DB_DIR, 'GeoLite2-ASN.mmdb'));
  } catch {
    logger.warn(`GeoLite2-ASN.mmdb not found in ${env.GEOIP_DB_DIR} — ASN lookups disabled`);
  }
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

    const subdivision = city?.subdivisions?.[0];

    return {
      countryCode: city?.country?.iso_code ?? null,
      city: city?.city?.names?.en ?? null,
      region: subdivision?.names?.en ?? null,
      regionCode: subdivision?.iso_code ?? null,
      asn: asnRecord
        ? `${asnRecord.autonomous_system_number ?? ''} ${asnRecord.autonomous_system_organization ?? ''}`.trim() ||
          null
        : null,
      isPrivateIp: false,
    };
  },
};
