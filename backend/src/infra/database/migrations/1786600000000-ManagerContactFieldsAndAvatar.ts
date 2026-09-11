import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `managers.telegram` / `managers.teams` — two more messenger handles alongside the
 * existing `skype`, so the edit form and the affiliate-facing contact card (issue #6)
 * can offer whichever channel a manager actually uses.
 *
 * `managers.contactEmail` — a public-facing address, separate from the login email on
 * `users`. The login email is account credentials, not something an admin edits from
 * the manager form; this is what the affiliate's contact card shows instead, falling
 * back to the login email when unset.
 *
 * `managers.avatarUrl` — same shape as `news_posts.imageUrl`: a CDN URL uploaded
 * through the existing `/uploads` module, not the bytes.
 *
 * All four nullable — every existing manager predates this and keeps working with the
 * initials-badge fallback the contact card already has.
 */
export class ManagerContactFieldsAndAvatar1786600000000 implements MigrationInterface {
  name = 'ManagerContactFieldsAndAvatar1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "managers" ADD "telegram" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "managers" ADD "teams" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "managers" ADD "contactEmail" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "managers" ADD "avatarUrl" character varying(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "contactEmail"`);
    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "teams"`);
    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "telegram"`);
  }
}
