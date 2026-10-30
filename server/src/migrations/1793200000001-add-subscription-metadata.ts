import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionMetadata1793200000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['note', 'supportUrl', 'websiteUrl']) {
      await queryRunner.query(
        `ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "${column}" character varying`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "clientUsage" text`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['note', 'supportUrl', 'websiteUrl', 'clientUsage']) {
      await queryRunner.query(
        `ALTER TABLE "subscription" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
