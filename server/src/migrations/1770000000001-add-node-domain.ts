import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNodeDomain1770000000001 implements MigrationInterface {
  name = 'AddNodeDomain1770000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "node"
      ADD COLUMN IF NOT EXISTS "domain" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "node" DROP COLUMN IF EXISTS "domain"`,
    );
  }
}
