import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `AFFILIATE_VERIFIED` row, and removes copy that the new per-template
 * designs now render themselves.
 *
 * Why a migration rather than the seed: `prod-bootstrap` only *creates* templates that
 * are missing and never touches existing rows, which is correct — it must not stamp on
 * wording an admin has edited. But that also means a fixture change never reaches a
 * database that has already been seeded, and three of these templates now say the same
 * thing twice: once as copy, once as a rendered block.
 *
 * Each edit is a targeted REPLACE of the exact fragment the original seed shipped, not
 * a whole-body overwrite. A row an admin has reworded no longer contains that fragment,
 * so it is left exactly as they wrote it — the fix reaches untouched installs and
 * nobody else. That also makes the migration safe to re-run.
 */
export class EmailCopyForTemplateDesigns1788300000000 implements MigrationInterface {
  name = 'EmailCopyForTemplateDesigns1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Literal id, and it must stay literal: seed/ids.ts derives these from a SHA-1 of
    // `fatexia-seed:email-template:<key>` formatted as a v5-shaped UUID, which is not
    // what Postgres' own uuid_generate_v5 produces. Computed with that function so the
    // row is the same one the seed would have written.
    await queryRunner.query(
      `INSERT INTO "email_templates" ("id", "templateKey", "name", "subject", "body", "availableMacros", "enabled")
       VALUES (
         'de1a794b-3ea5-5323-9647-fd39494ed82d',
         'AFFILIATE_VERIFIED',
         'Email verified',
         'Email verified — your {network_name} application is in review',
         $1,
         $2,
         true
       )
       ON CONFLICT ("templateKey") DO NOTHING`,
      [
        'Hi {affiliate_name},\n\nYour email is confirmed. Your application is now with our team.\n\nWe look at traffic sources and volume, and usually come back within one business day. You will get an email either way — there is nothing to do until then.',
        JSON.stringify(['{affiliate_name}', '{network_name}', '{support_email}']),
      ],
    );

    // AFFILIATE_WELCOME: the review sentence is now the stepped block in register.ts.
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, '')
       WHERE "templateKey" = 'AFFILIATE_WELCOME' AND "body" LIKE '%' || $1 || '%'`,
      ['\n\nOnce verified, your application moves to review and we usually respond within one business day.'],
    );

    // AFFILIATE_APPROVED: bare macro renders a button captioned "Open"; the manager
    // sentence is now a contact card.
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, $2)
       WHERE "templateKey" = 'AFFILIATE_APPROVED' AND "body" LIKE '%' || $1 || '%'`,
      ['\n\n{portal_link}\n\n', '\n\n[Open your dashboard]({portal_link})\n\n'],
    );
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, '')
       WHERE "templateKey" = 'AFFILIATE_APPROVED' AND "body" LIKE '%' || $1 || '%'`,
      [
        '\n\nYour manager is **{manager_name}**, and they are the person to ask about caps, payout bumps or new offers.',
      ],
    );

    // PAYOUT_SENT: the four values now render as a figure panel plus a table.
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "body" = REPLACE("body", $1, $2)
       WHERE "templateKey" = 'PAYOUT_SENT' AND "body" LIKE '%' || $1 || '%'`,
      [
        'Your payout has been sent. Here are the details:\n\n- Amount: **{amount}**\n- Invoice: {invoice_number}\n- Period: {period}\n- Reference: {payment_reference}\n\nDepending on your payout method it can take a few business days to arrive.',
        'Your payout has been sent.',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only the row is reversible. The copy edits are not restored: by the time this
    // runs an admin may have edited the shortened text, and putting the old wording
    // back would overwrite theirs.
    await queryRunner.query(`DELETE FROM "email_templates" WHERE "templateKey" = 'AFFILIATE_VERIFIED'`);
  }
}
