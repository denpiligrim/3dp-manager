import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperations1793300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE inbound ADD COLUMN IF NOT EXISTS "isPending" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS operation (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), kind varchar NOT NULL, title varchar NOT NULL,
      job boolean NOT NULL DEFAULT false, status varchar NOT NULL DEFAULT 'queued',
      "activeKey" varchar UNIQUE, "parentId" varchar, subject varchar NOT NULL DEFAULT '', message varchar NOT NULL DEFAULT '',
      completed integer NOT NULL DEFAULT 0, total integer NOT NULL DEFAULT 0, payload jsonb, result jsonb,
      "errorResponse" jsonb, "errorStatus" integer,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "scheduledAt" timestamptz NOT NULL DEFAULT now(), "startedAt" timestamptz, "finishedAt" timestamptz
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_operation_createdAt" ON operation ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_operation_queue" ON operation (status, "scheduledAt") WHERE job = true',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS operation');
    await queryRunner.query(
      'ALTER TABLE inbound DROP COLUMN IF EXISTS "isPending"',
    );
  }
}
