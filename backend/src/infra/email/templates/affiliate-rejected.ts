import { note, statusPanel } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Application declined — `AFFILIATE_REJECTED`.
 *
 * The most restrained design in the set, on purpose. There is no figure to pull out,
 * no sequence to follow and nothing to act on, and the honest response to that is
 * less structure rather than more — a decorated rejection reads as gloating.
 *
 * Neutral panel, never `bad`: red would state that something went wrong, and nothing
 * did. The applicant was assessed and the answer was no. No call to action either;
 * there is nowhere useful to send them, and a button would be there to look complete
 * rather than to be used.
 *
 * The one addition is the door. "You are welcome to apply again later" is easy to
 * read as politeness — naming what actually changes an outcome makes it a real
 * invitation instead of a form of words.
 */
export const affiliateRejectedTemplate: TemplateDesign = {
  render({ content, networkName }: TemplateContext): string {
    return [
      statusPanel({
        tone: 'neutral',
        pill: 'Not approved',
        headline: 'We cannot open an account this time',
        caption: `Your application to ${networkName} has been reviewed.`,
      }),
      content,
      note({
        title: 'If you want to reapply',
        body: 'Applications are judged mostly on traffic sources and volume, so what usually changes an outcome is a new source, more volume, or results from another network you can point to. There is no waiting period — reply to this email if you would rather talk it through first.',
      }),
    ].join('\n');
  },
};
