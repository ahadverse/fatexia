import type { Request } from 'express';
import { normalizeIp } from '../modules/geo-source/geo-source';

/**
 * The client address to store and geo-resolve.
 *
 * Express hands back IPv4-mapped IPv6 (`::ffff:1.2.3.4`) on a dual-stack socket, which
 * MaxMind will not match and which reads badly in the UI — `normalizeIp` strips it.
 *
 * What `req.ip` actually contains depends on `trust proxy` (set from `TRUST_PROXY` in
 * app.ts). That setting must be the **number of proxy hops**, never `true`: with `true`
 * Express walks the whole `X-Forwarded-For` chain and takes the left-most entry, which
 * is entirely client-supplied — an affiliate could then choose their own country and
 * dodge the datacenter/ASN check by sending a header. See .env.example.
 */
export function clientIp(req: Request): string {
  return normalizeIp(req.ip) ?? 'unknown';
}
