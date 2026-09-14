import { useEffect } from 'react';
import { toast } from '@fatexia/ui';
import type { ConversionNewPayload } from '@fatexia/types';
import { money } from '../lib/format';
import { playConversionSound } from '../lib/notification-sound';
import { useRealtime } from '../realtime/RealtimeContext';

/**
 * Announces every conversion the moment it is recorded, wherever it came from.
 *
 * Mounted once in `Shell.tsx` rather than on the Conversions page: a conversion arriving
 * is news on any screen, and the whole point is to hear about it while looking at
 * something else. Both origins reach here through the same event — an advertiser's
 * postback (written by the Tracker and bridged over Redis) and an admin adding one by
 * hand from the click drawer — so there is one alert, not two that could drift apart.
 *
 * Nothing is persisted behind this. A missed toast is a missed toast; the conversion is
 * in the database either way and the Conversions report is the record.
 */
export function useConversionAlerts(): void {
  const { onConversion } = useRealtime();

  useEffect(
    () =>
      onConversion((conversion: ConversionNewPayload) => {
        const offer = conversion.offerName ?? 'an offer';
        const amount = money(conversion.payoutAmount, conversion.currency);

        toast.success(
          conversion.source === 'manual'
            ? `Conversion #${conversion.refId} added on ${offer} — ${amount}`
            : `New conversion #${conversion.refId} on ${offer} — ${amount}`,
        );

        // After the toast is queued, so a browser that refuses to play audio still
        // leaves the message on screen.
        playConversionSound();
      }),
    [onConversion],
  );
}
