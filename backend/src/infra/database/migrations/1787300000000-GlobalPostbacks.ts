import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `global_postbacks` — network-level postbacks, both directions, configured in
 * Admin → Settings rather than per offer.
 *
 * Inbound entries authorise a conversion for any offer, so one advertiser integration
 * covers the whole catalogue instead of fresh credentials per offer. Outbound entries
 * are called for every approved conversion alongside the affiliate's own postback.
 *
 * Direction-specific columns are nullable: `url` only means something outbound,
 * `secret`/`allowedIps` only inbound. One table because the admin surface is one list
 * and the lifecycle is identical either way.
 */
export class GlobalPostbacks1787300000000 implements MigrationInterface {
  name = 'GlobalPostbacks1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "global_postbacks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "direction" character varying(10) NOT NULL,
        "url" character varying(1000),
        "secret" character varying(255),
        "allowedIps" character varying(500),
        "enabled" boolean NOT NULL DEFAULT true,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_global_postbacks" PRIMARY KEY ("id")
      )
    `);
    // The inbound path looks entries up by direction on every postback that fails the
    // per-offer secret check.
    await queryRunner.query(`CREATE INDEX "IDX_global_postbacks_direction" ON "global_postbacks" ("direction", "enabled")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_global_postbacks_direction"`);
    await queryRunner.query(`DROP TABLE "global_postbacks"`);
  }
}
