import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OperationStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'interrupted'
  | 'warning';

@Entity('operation')
@Index('IDX_operation_createdAt', ['createdAt'])
@Index('IDX_operation_queue', ['status', 'scheduledAt'], {
  where: 'job = true',
})
export class Operation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() kind: string;
  @Column() title: string;
  @Column({ default: false }) job: boolean;
  @Column({ default: 'queued' }) status: OperationStatus;
  @Column({ type: 'varchar', nullable: true, unique: true }) activeKey:
    | string
    | null;
  @Column({ type: 'varchar', nullable: true }) parentId: string | null;
  @Column({ default: '' }) subject: string;
  @Column({ default: '' }) message: string;
  @Column({ default: 0 }) completed: number;
  @Column({ default: 0 }) total: number;
  @Column({ type: 'jsonb', nullable: true, select: false }) payload: {
    args: (string | null)[];
    checkpoint?: { cursor: string; completed: number; failed: number };
  } | null;
  @Column({ type: 'jsonb', nullable: true, select: false }) result: unknown;
  @Column({ type: 'jsonb', nullable: true, select: false })
  errorResponse: unknown;
  @Column({ type: 'integer', nullable: true }) errorStatus: number | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  scheduledAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
}
