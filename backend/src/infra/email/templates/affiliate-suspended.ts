import { alert, factRows, note, statusPanel } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Account suspended — `AFFILIATE_SUSPENDED`.
 *
 * The one email where the reader must register the outcome before reading a word, so
 * it opens on the state rather than closing on it.
 *
 * Neutral panel and a `warning` alert, never the ink panel or `bad`. A suspension
 * pending review is a hold, and the copy says so; the celebratory treatment would be
 * grotesque here, and red would read as a permanent ban and provoke a furious reply
 * to a decision nobody has made yet.
 *
 * The alert answers the three questions the copy leaves open — which are the three
 * that furious reply would have asked. That earnings are held rather than lost is the
 * single most de-escalating fact available, and it belongs above the fold.
 */
export const affiliateSuspendedTemplate: TemplateDesign = {
  render({ content, networkName }: TemplateContext): string {
    return [
      statusPanel({
        tone: 'neutral',
        pill: 'On hold',
        headline: 'Your account is suspended',
        caption: `Pending a traffic-quality review by the ${networkName} team.`,
      }),
      alert({
        tone: 'warning',
        title: 'What this means right now',
        body: 'Your links have stopped converting and no new clicks are being recorded. Conversions you have already earned are held, not cancelled — they stay on your balance while the review runs.',
      }),
      content,
      factRows([
        { label: 'Traffic', value: 'Paused' },
        { label: 'Existing earnings', value: 'Held, not cancelled' },
        { label: 'Decision', value: 'By email, to this address' },
      ]),
      note({
        title: 'Getting it lifted',
        body: 'Reply to this email — it reaches your manager directly. The fastest way through a traffic-quality review is the detail only you have: which sources the traffic came from, and what changed recently.',
      }),
    ].join('\n');
  },
};
