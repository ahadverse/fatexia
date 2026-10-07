import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The AFFILIATE_WELCOME row (the verification email) was seeded with a body that had
 * no `{code}` in it, and the seed never overwrites an existing row — so databases
 * created before the code was added send a "welcome" with nothing to type into the
 * verify form. Rewrites it to the current copy.
 *
 * Exact-match on the old subject and body, so wording an admin changed is left alone.
 */
const OLD_SUBJECT = 'Welcome to {network_name}, {affiliate_name}';
const OLD_BODY =
  'Hi {affiliate_name},\n\nThanks for applying to {network_name}. Your application is under review and we usually respond within one business day.\n\n— The {network_name} team';

const NEW_SUBJECT = 'Verify your email for {network_name}';
const NEW_BODY =
  'Hi {affiliate_name},\n\nThanks for applying to {network_name}. First, verify your email with the code below — it expires in 15 minutes.\n\n{code}\n\n— The {network_name} team';
const NEW_MACROS = ['{affiliate_name}', '{network_name}', '{support_email}', '{code}'];

export class VerificationEmailCode1790000000000 implements MigrationInterface {
  name = 'VerificationEmailCode1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "subject" = $1, "body" = $2, "availableMacros" = $3::jsonb
       WHERE "templateKey" = 'AFFILIATE_WELCOME' AND "subject" = $4 AND "body" = $5`,
      [NEW_SUBJECT, NEW_BODY, JSON.stringify(NEW_MACROS), OLD_SUBJECT, OLD_BODY],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_templates"
       SET "subject" = $1, "body" = $2, "availableMacros" = $3::jsonb
       WHERE "templateKey" = 'AFFILIATE_WELCOME' AND "subject" = $4 AND "body" = $5`,
      [OLD_SUBJECT, OLD_BODY, JSON.stringify(['{affiliate_name}', '{network_name}', '{support_email}']), NEW_SUBJECT, NEW_BODY],
    );
  }
}
