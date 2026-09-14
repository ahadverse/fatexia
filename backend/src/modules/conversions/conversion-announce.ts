import { logger } from '../../common/logger';
import { emitToRoom } from '../../infra/realtime/socket-server';
import { REALTIME_EVENTS, ROOMS, type ConversionNewPayload } from '../../infra/realtime/events';

/**
 * Tells whoever has the Admin portal open that a conversion just landed.
 *
 * One helper for both origins on purpose. A conversion arrives either from an
 * advertiser's postback (postback.service, running in the Tracker process) or from an
 * admin adding it by hand (conversion.service, in the API process), and the person
 * watching the dashboard cares about the event, not about which process produced it —
 * so the announcement has to be identical either way, and the Redis bridge in
 * socket-server.ts is what lets the Tracker make it at all.
 *
 * Live-only: no notification row is written. The bell is for things worth reading later,
 * and a network doing a thousand conversions a day would bury everything else in it
 * within a day. This is the alert that fires while someone is looking.
 *
 * Never throws. A conversion that was written but not announced is a missed toast; a
 * conversion that failed to be written because a socket emit threw would be a lost sale.
 */
export function announceConversion(
  conversion: {
    id: string;
    refId: number;
    // decimal columns come back as strings; the DTO has already turned them into numbers.
    payoutAmount: number | string;
    currency: string;
    status: string;
    offerName?: string | null;
  },
  source: ConversionNewPayload['source'],
): void {
  try {
    const payload: ConversionNewPayload = {
      conversionId: conversion.id,
      refId: conversion.refId,
      offerName: conversion.offerName ?? null,
      payoutAmount: Number(conversion.payoutAmount),
      currency: conversion.currency,
      status: conversion.status,
      source,
    };
    emitToRoom(ROOMS.network, REALTIME_EVENTS.CONVERSION_NEW, payload);
  } catch (err) {
    logger.warn({ err, conversionId: conversion.id }, 'Could not announce a conversion');
  }
}
