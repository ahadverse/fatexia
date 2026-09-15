import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The billing ledger, plus the two invoice-integrity fixes that go with it.
 *
 * **`transactions`** — an append-only record of every money event against an affiliate:
 * an invoice raised, a payout sent, a payout refused, an invoice released, and manual
 * adjustments. The invoice service writes these inside the same transaction that moves
 * the invoice, so the two can never disagree about what happened. Balances are still
 * recomputed from conversions (money integrity rule); nothing derives a balance here.
 *
 * **`invoice_number_seq`** — invoice numbers were derived from `COUNT(*)`, which is only
 * correct while no invoice is ever deleted and no two batches overlap. Otherwise two
 * rows claim the same number, the unique index rejects the second, and a batch dies
 * partway through. A sequence is atomic and never repeats. It is set to the highest
 * number already issued, so existing invoices keep theirs and the next one continues
 * from there.
 *
 * **`invoices.releasedAt`** — records that an invoice was cancelled and its conversions
 * handed back to the payable pool. Rejection alone leaves them stamped (deliberately:
 * a failed payout should still reconcile against its rows), so without this column
 * there was no way to tell a rejected invoice whose money is stuck from one whose money
 * is back in circulation — and no supported way to put it back at all.
 *
 * The ledger is backfilled from the invoices that already exist, so the Transactions
 * page opens onto the network's real history rather than an empty table.
 */
export class BillingLedgerAndInvoiceIntegrity1788900000000 implements MigrationInterface {
  name = 'BillingLedgerAndInvoiceIntegrity1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."transactions_type_enum" AS ENUM(
        'INVOICE_GENERATED', 'PAYOUT_SENT', 'PAYOUT_REJECTED', 'INVOICE_RELEASED', 'MANUAL_ADJUSTMENT'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "invoiceId" uuid,
        "invoiceNumber" character varying,
        "type" "public"."transactions_type_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL DEFAULT '0',
        "currency" character varying NOT NULL DEFAULT 'USD',
        "reference" character varying,
        "description" text,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_affiliateId" ON "transactions" ("affiliateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_invoiceId" ON "transactions" ("invoiceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_createdAt" ON "transactions" ("createdAt")`);

    await queryRunner.query(`ALTER TABLE "invoices" ADD "releasedAt" TIMESTAMP`);

    await queryRunner.query(`CREATE SEQUENCE "invoice_number_seq" AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE`);
    // Reads the trailing digits of the highest existing "INV-000042". `is_called` is
    // false when there are none, so the very first invoice on a fresh network is
    // INV-000001 rather than INV-000002.
    await queryRunner.query(`
      WITH highest AS (
        SELECT COALESCE(MAX((substring("invoiceNumber" from '[0-9]+$'))::bigint), 0) AS value FROM "invoices"
      )
      SELECT setval('invoice_number_seq', GREATEST(highest.value, 1), highest.value > 0) FROM highest
    `);

    // Every invoice that exists became a ledger row, dated when the invoice was raised.
    await queryRunner.query(`
      INSERT INTO "transactions" ("affiliateId", "invoiceId", "invoiceNumber", "type", "amount", "currency", "description", "createdAt")
      SELECT
        "affiliateId",
        "id",
        "invoiceNumber",
        'INVOICE_GENERATED'::"public"."transactions_type_enum",
        "amount",
        "currency",
        'Invoice raised (backfilled)',
        "createdAt"
      FROM "invoices"
    `);

    // ...and every one already paid became a second row, dated when the money moved.
    await queryRunner.query(`
      INSERT INTO "transactions" ("affiliateId", "invoiceId", "invoiceNumber", "type", "amount", "currency", "reference", "description", "createdAt")
      SELECT
        "affiliateId",
        "id",
        "invoiceNumber",
        'PAYOUT_SENT'::"public"."transactions_type_enum",
        "amount",
        "currency",
        "paymentReference",
        'Payout sent (backfilled)',
        COALESCE("paidAt", "updatedAt", "createdAt")
      FROM "invoices"
      WHERE "status" = 'PAID'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "invoice_number_seq"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "releasedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_invoiceId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_affiliateId"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
  }
}
