import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rewrites the subject lines.
 *
 * A subject here does two jobs: it is the line in a crowded inbox, and the shell
 * renders it again as the message's `h1`. So each one has to be specific enough to
 * pick out of a list and read as a headline once opened — which rules out both the
 * vague ("Update on your request") and the shouty ("Action needed:").
 *
 * The changes are of three kinds:
 *
 * - **Say it.** "Update on your application" is a euphemism that makes the reader
 *   open the mail to learn they were declined. Two of these now state the outcome.
 * - **Lead with what is wanted.** A payout subject led with the invoice number and
 *   put the amount last; the amount is the only part anyone reads. Offers now carry
 *   the rate, which is the question that decides whether the mail gets opened at all.
 * - **Drop the redundant network name** where the sender already carries it and the
 *   room is better spent on the specific.
 *
 * Exact-match on the old subject, so an admin's own wording is never overwritten.
 */
const SUBJECTS: Array<{ key: string; from: string; to: string }> = [
  {
    key: 'ACCESS_REQUEST_REJECTED',
    from: 'Update on your request for {offer_name}',
    to: 'Your access request for {offer_name} was not approved',
  },
  {
    key: 'AFFILIATE_APPROVED',
    from: 'Your {network_name} account is live',
    to: "You're approved — your {network_name} account is live",
  },
  {
    key: 'AFFILIATE_REJECTED',
    from: 'Update on your {network_name} application',
    to: 'Your {network_name} application was not approved',
  },
  {
    key: 'AFFILIATE_SUSPENDED',
    from: 'Your {network_name} account has been suspended',
    // "On hold" over "suspended": the review has not concluded, and the harsher word
    // in a subject line provokes a reply to a decision nobody has made yet.
    to: 'Your {network_name} account is on hold',
  },
  {
    key: 'AFFILIATE_VERIFIED',
    from: 'Email verified — your {network_name} application is in review',
    to: 'Email verified — your application is in review',
  },
  {
    key: 'PAYOUT_SENT',
    // Also fixes the hyphen standing in for an en dash.
    from: 'Payment {invoice_number} sent - {amount}',
    to: '{amount} sent — invoice {invoice_number}',
  },
  {
    key: 'PAYOUT_REJECTED',
    from: 'Payment {invoice_number} could not be processed',
    to: 'Payment {invoice_number} could not be sent',
  },
  {
    key: 'OFFER_LIVE',
    from: '{offer_name} is now live',
    to: '{offer_name} is live — {payout} per conversion',
  },
  {
    key: 'ACCESS_REQUEST_APPROVED',
    from: 'You now have access to {offer_name}',
    to: 'You can now run {offer_name}',
  },
];

export class EmailSubjects1788800000000 implements MigrationInterface {
  name = 'EmailSubjects1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { key, from, to } of SUBJECTS) {
      await queryRunner.query(`UPDATE "email_templates" SET "subject" = $1 WHERE "templateKey" = $2 AND "subject" = $3`, [
        to,
        key,
        from,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { key, from, to } of SUBJECTS) {
      await queryRunner.query(`UPDATE "email_templates" SET "subject" = $1 WHERE "templateKey" = $2 AND "subject" = $3`, [
        from,
        key,
        to,
      ]);
    }
  }
}
