import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notifications become per-recipient rows.
 *
 * A null `userId` used to mean "broadcast", which made the audience a property of the
 * *query* rather than of the row. Two live bugs followed:
 *
 * 1. `findForUser` matched `("userId" = :userId OR "userId" IS NULL)`, so an affiliate
 *    calling GET /notifications received the network's internal notices — e.g.
 *    "2 affiliate applications pending review" linking to /affiliates/pending.
 * 2. A broadcast had one shared `readAt`, so the first admin to open a notice marked it
 *    read for every admin — and `markRead` was keyed on id alone, so any authenticated
 *    user could clear any notification by guessing a uuid.
 *
 * Fanning out at write time fixes both structurally: audience and read state are now
 * properties of the row. `ROOMS.user(userId)` already exists and every socket already
 * joins it, so targeted realtime delivery needs no room work.
 */
export class NotificationRecipients1785700000000 implements MigrationInterface {
  name = 'NotificationRecipients1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing broadcasts are duplicated to every active staff member so nothing is
    // lost — they were written for the network, and that is who keeps them.
    await queryRunner.query(`
      INSERT INTO "notifications" ("userId", "level", "category", "title", "body", "link", "readAt", "createdAt")
      SELECT u.id, n.level, n.category, n.title, n.body, n.link, NULL, n."createdAt"
      FROM "notifications" n
      CROSS JOIN "users" u
      WHERE n."userId" IS NULL
        AND u.role IN ('ADMIN', 'MANAGER')
        AND u.status = 'ACTIVE'
    `);

    await queryRunner.query(`DELETE FROM "notifications" WHERE "userId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "userId" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("userId", "readAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_unread"`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "userId" DROP NOT NULL`);

    // Lossy, and deliberately so: collapse each fanned-out set back to a single
    // broadcast row, keeping the oldest. Per-recipient read state cannot survive a
    // shape that has only one `readAt`. Same precedent as the messages.subject drop.
    await queryRunner.query(`
      DELETE FROM "notifications" a
      USING "notifications" b
      WHERE a.title = b.title
        AND a."createdAt" = b."createdAt"
        AND a.category = b.category
        AND a.id > b.id
    `);
    await queryRunner.query(`UPDATE "notifications" SET "userId" = NULL`);
  }
}
