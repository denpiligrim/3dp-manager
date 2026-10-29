import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionClient1793200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "clientId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "clientAutoCreate" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP COLUMN IF EXISTS "clientAutoCreate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP COLUMN IF EXISTS "clientId"`,
    );
  }
}
