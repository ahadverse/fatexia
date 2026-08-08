/**
 * Renders the branded email shell to HTML files you can open in a browser, so the
 * layout can be checked without sending real mail (or burning Brevo quota) on every
 * tweak. Covers the three block types the renderer special-cases: a verification
 * code, a CTA button from a bare URL, and a bullet list.
 *
 * Run: npx tsx scripts/dev/preview-email.ts [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderEmailHtml } from '../../src/infra/email/email-layout';

const outDir = resolve(process.argv[2] ?? join(__dirname, '../../.email-preview'));
mkdirSync(outDir, { recursive: true });

const SAMPLES: { file: string; subject: string; body: string }[] = [
  {
    file: 'verify.html',
    subject: 'Verify your email for Fatexia',
    body: `Hi Ahad,

Thanks for applying to Fatexia. First, verify your email with the code below — it expires in 15 minutes.

701467

Once verified, your application moves to review and we usually respond within one business day.

— The Fatexia team`,
  },
  {
    file: 'approved.html',
    subject: 'Your Fatexia account is live',
    body: `Hi Ahad,

Your account is approved — you can log in now and start sending traffic.

https://affiliates.fatexia.com

A few things worth doing first:

- Browse the offers you have access to and grab a tracking link
- Set your payout method under Profile
- Add your postback URL so your own tracker stays in sync

Your manager is **Sarah Chen**, and they are the person to ask about caps, payout bumps or new offers.`,
  },
  {
    file: 'payout.html',
    subject: 'Payment INV-000042 sent - 1,240.00 USD',
    body: `Hi Ahad,

Your payout has been sent. Here are the details:

- Amount: **1,240.00 USD**
- Invoice: INV-000042
- Period: 2026-07-01 to 2026-07-31
- Reference: TRX-88213

Depending on your payout method it can take a few business days to arrive.`,
  },
];

for (const sample of SAMPLES) {
  const html = renderEmailHtml({
    subject: sample.subject,
    body: sample.body,
    networkName: 'Fatexia',
    supportEmail: 'support@fatexia.com',
  });
  writeFileSync(join(outDir, sample.file), html);
  console.log(`wrote ${join(outDir, sample.file)}`);
}
