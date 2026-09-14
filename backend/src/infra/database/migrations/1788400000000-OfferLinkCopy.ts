import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Labels the offer links, and drops one more line the design now renders.
 *
 * `{offer_link}` sat on its own line in both offer emails, which the layout turns into
 * a button captioned "Open" — a button that names neither its destination nor its
 * purpose. Wrapping it in `[label](…)` is what gives it a real caption.
 *
 * Paired with the service change that made `{offer_link}` point at the portal's offer
 * page instead of the affiliate's tracking link. That was the more serious half: a
 * tracking URL in an email is fetched by spam scanners and Gmail's link prefetcher, so
 * every recipient was accruing clicks they never made, from datacenter IPs the fraud
 * module scores against them.
 *
 * Targeted REPLACE, like the previous copy migration — a row an admin has reworded no
 * longer contains the fragment and is left alone.
 */
export class OfferLinkCopy1788400000000 implements MigrationInterface {
  name = 'OfferLinkCopy1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, $2)
       WHERE "templateKey" = 'ACCESS_REQUEST_APPROVED' AND "body" LIKE '%' || $1 || '%'`,
      ['\n\n{offer_link}', '\n\n[Open the offer]({offer_link})'],
    );

    // Done in one replace rather than two so the caps sentence is only removed from a
    // body that still has the bare macro before it — i.e. one that is still the seed.
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, $2)
       WHERE "templateKey" = 'OFFER_LIVE' AND "body" LIKE '%' || $1 || '%'`,
      [
        '\n\n{offer_link}\n\nCheck the offer page for the current caps and geo targeting before you scale.',
        '\n\n[View the offer]({offer_link})',
      ],
    );
  }

  public async down(): Promise<void> {
    // Not restored — an admin may have edited the labelled version by now, and putting
    // the bare macro back would overwrite their wording with a worse button.
  }
}
