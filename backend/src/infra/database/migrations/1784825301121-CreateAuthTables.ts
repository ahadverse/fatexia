import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthTables1784825301121 implements MigrationInterface {
    name = 'CreateAuthTables1784825301121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'MANAGER', 'AFFILIATE')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'PENDING', 'BLOCKED', 'REJECTED', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'PENDING', "lastLogin" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "login_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "ip" character varying NOT NULL, "userAgent" character varying, "success" boolean NOT NULL, "reason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15f7b02ad55d5ba905b2962ebab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "affiliates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4401dd6b157ff32422564f53242" UNIQUE ("userId"), CONSTRAINT "REL_4401dd6b157ff32422564f5324" UNIQUE ("userId"), CONSTRAINT "PK_5458bf988fb83086da3a14b9ff9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."managers_managerrole_enum" AS ENUM('GENERAL', 'ACCOUNT', 'AFFILIATE')`);
        await queryRunner.query(`CREATE TABLE "managers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "managerRole" "public"."managers_managerrole_enum" NOT NULL, "reportsToId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_657a998a2bb0be0d3dcf91fb273" UNIQUE ("userId"), CONSTRAINT "REL_657a998a2bb0be0d3dcf91fb27" UNIQUE ("userId"), CONSTRAINT "PK_e70b8cc457276d9b4d82342a8ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "login_logs" ADD CONSTRAINT "FK_dfd602e41a69edd16aed5075a7c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "affiliates" ADD CONSTRAINT "FK_4401dd6b157ff32422564f53242" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "managers" ADD CONSTRAINT "FK_657a998a2bb0be0d3dcf91fb273" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "managers" ADD CONSTRAINT "FK_264e61a368f1438ef01503d4abe" FOREIGN KEY ("reportsToId") REFERENCES "managers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "managers" DROP CONSTRAINT "FK_264e61a368f1438ef01503d4abe"`);
        await queryRunner.query(`ALTER TABLE "managers" DROP CONSTRAINT "FK_657a998a2bb0be0d3dcf91fb273"`);
        await queryRunner.query(`ALTER TABLE "affiliates" DROP CONSTRAINT "FK_4401dd6b157ff32422564f53242"`);
        await queryRunner.query(`ALTER TABLE "login_logs" DROP CONSTRAINT "FK_dfd602e41a69edd16aed5075a7c"`);
        await queryRunner.query(`DROP TABLE "managers"`);
        await queryRunner.query(`DROP TYPE "public"."managers_managerrole_enum"`);
        await queryRunner.query(`DROP TABLE "affiliates"`);
        await queryRunner.query(`DROP TABLE "login_logs"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
