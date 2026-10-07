import { MigrationInterface, QueryRunner } from 'typeorm';

/** Admin broadcast emails: the campaign, and its snapshotted per-recipient send queue. */
export class EmailCampaigns1789900000000 implements MigrationInterface {
  name = 'EmailCampaigns1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "email_campaigns_audience_enum" AS ENUM('ALL','AFFILIATES','ADVERTISERS','MANAGERS')`);
    await queryRunner.query(`CREATE TYPE "email_campaigns_status_enum" AS ENUM('SENDING','COMPLETED','CANCELLED')`);
    await queryRunner.query(`CREATE TYPE "email_campaign_recipients_status_enum" AS ENUM('PENDING','SENT','FAILED','SKIPPED')`);
    await queryRunner.query(
      `CREATE TABLE "email_campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject" character varying(200) NOT NULL, "body" text NOT NULL, "macros" jsonb, "audience" "email_campaigns_audience_enum" NOT NULL, "activeOnly" boolean NOT NULL DEFAULT true, "status" "email_campaigns_status_enum" NOT NULL DEFAULT 'SENDING', "totalRecipients" integer NOT NULL DEFAULT 0, "sentCount" integer NOT NULL DEFAULT 0, "failedCount" integer NOT NULL DEFAULT 0, "createdById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "finishedAt" TIMESTAMP, CONSTRAINT "PK_email_campaigns_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_email_campaigns_status" ON "email_campaigns" ("status")`);
    await queryRunner.query(
      `CREATE TABLE "email_campaign_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaignId" uuid NOT NULL, "email" character varying NOT NULL, "kind" character varying(20) NOT NULL, "fullName" character varying(120), "publicId" character varying(20), "status" "email_campaign_recipients_status_enum" NOT NULL DEFAULT 'PENDING', "error" text, "sentAt" TIMESTAMP, CONSTRAINT "PK_email_campaign_recipients_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ecr_campaign_status" ON "email_campaign_recipients" ("campaignId","status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ecr_campaign_email" ON "email_campaign_recipients" ("campaignId","email")`);
    await queryRunner.query(
      `ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "FK_ecr_campaignId" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_campaign_recipients"`);
    await queryRunner.query(`DROP TABLE "email_campaigns"`);
    await queryRunner.query(`DROP TYPE "email_campaign_recipients_status_enum"`);
    await queryRunner.query(`DROP TYPE "email_campaigns_status_enum"`);
    await queryRunner.query(`DROP TYPE "email_campaigns_audience_enum"`);
  }
}
