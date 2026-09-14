import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trims `AFFILIATE_APPROVED` down to its opening sentence.
 *
 * The design now renders the dashboard button and a stepped "first three things"
 * block, so the copy's own link and bullet list were the same two things a second
 * time. A sequence belongs in the stepped block — it is ordered, and the copy's list
 * could not show that.
 *
 * Targeted REPLACE like the earlier copy migrations: a row an admin has reworded no
 * longer matches and is left alone.
 */
export class ApprovedCopyForStepsBlock1788700000000 implements MigrationInterface {
  name = 'ApprovedCopyForStepsBlock1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Two shapes to match: the original seed with the bare `{portal_link}`, and the
    // labelled version written by migration 1788300000000 on installs that already
    // took it. Both collapse to the same result.
    for (const link of ['{portal_link}', '[Open your dashboard]({portal_link})']) {
      await queryRunner.query(
        `UPDATE "email_templates"
         SET "body" = REPLACE("body", $1, $2)
         WHERE "templateKey" = 'AFFILIATE_APPROVED' AND "body" LIKE '%' || $1 || '%'`,
        [
          `Your account is approved — you can log in now and start sending traffic.\n\n${link}\n\nA few things worth doing first:\n\n- Browse the offers you have access to and grab a tracking link\n- Set your payout method under Profile\n- Add your postback URL so your own tracker stays in sync`,
          'Your application has been reviewed and approved. You can sign in now and start sending traffic.',
        ],
      );
    }
  }

  public async down(): Promise<void> {
    // Not restored: by now an admin may have edited the shortened copy, and putting
    // the old body back would overwrite their wording.
  }
}
