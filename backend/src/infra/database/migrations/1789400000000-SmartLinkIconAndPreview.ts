import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a smart-link the two presentation fields an offer already has: a thumbnail and
 * a preview link.
 *
 * Both exist on `offers` and are rendered by the admin's offer list and form. A
 * smart-link is the other thing an affiliate is handed and asked to send traffic to,
 * and it had neither — so the links column showed names with nothing beside them, and
 * there was no way to look at the landing page a link points to without clicking the
 * live tracking URL and logging a click.
 *
 * Nullable with no default, and no backfill. Every existing link keeps rendering from
 * its initials, which is what the list already does when an image is absent; inventing
 * a placeholder URL would put a broken image into every row instead.
 *
 * `previewLink` is deliberately not validated as a URL at the column level — the DTO
 * does that on the way in, and a check constraint here would reject rows the
 * application layer already guarantees while making the column harder to change.
 */
export class SmartLinkIconAndPreview1789400000000 implements MigrationInterface {
  name = 'SmartLinkIconAndPreview1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "iconUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "previewLink" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "previewLink"`);
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "iconUrl"`);
  }
}
