import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `news_posts.imageUrl` — the cover image for a news card.
 *
 * Added because the affiliate dashboard now surfaces the latest posts as a card grid
 * rather than a list of headings, and a card without an image is mostly empty space.
 * Nullable: every existing post predates this, and a post without a cover still
 * renders (the card falls back to a tinted panel with the title).
 *
 * Stores a CDN URL, not the bytes — uploads go to S3 through the existing
 * `/uploads` module, same as offer thumbnails.
 */
export class AddNewsImageUrl1786500000000 implements MigrationInterface {
  name = 'AddNewsImageUrl1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "news_posts" ADD "imageUrl" character varying(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "news_posts" DROP COLUMN "imageUrl"`);
  }
}
