import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  IsNull,
  LessThan,
  QueryRunner,
  Repository,
} from 'typeorm';
import { Operation, OperationStatus } from './operation.entity';

export const OPERATION_LOCK = 73492017;
type Handler = (args: (string | null)[]) => Promise<unknown>;
class OperationYield extends Error {}

@Injectable()
export class OperationsService implements OnApplicationShutdown {
  private readonly logger = new Logger(OperationsService.name);
  private readonly handlers = new Map<string, Handler>();
  private processing = false;
  private stopping = false;
  private current?: Operation;
  private lease?: QueryRunner;

  constructor(
    @InjectRepository(Operation) private readonly repo: Repository<Operation>,
    private readonly db: DataSource,
  ) {}

  register(kind: string, handler: Handler) {
    this.handlers.set(kind, handler);
  }
  onApplicationShutdown() {
    this.stopping = true;
  }

  async enqueue(kind: string, title: string, args: (string | null)[] = []) {
    const activeKey = kind.endsWith('.all')
      ? kind
      : `${kind}:${args[0] || 'all'}`;
    const existing = await this.repo.findOne({ where: { activeKey } });
    if (existing)
      return {
        jobId: existing.id,
        status: existing.status,
        success: true,
        message: 'Задача уже в очереди',
      };
    if (
      (await this.repo.count({
        where: { status: In(['queued', 'running']), job: true },
      })) >= 1000
    ) {
      throw new ConflictException(
        'Очередь заполнена. Дождитесь завершения текущих задач.',
      );
    }
    try {
      const operation = await this.repo.save(
        this.repo.create({
          kind,
          title,
          job: true,
          activeKey,
          status: 'queued',
          payload: { args },
          subject: args[0] || '',
        }),
      );
      return {
        jobId: operation.id,
        status: operation.status,
        success: true,
        message:
          'Задача добавлена в очередь. Ход выполнения доступен в Журнале.',
      };
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error;
      const duplicate = await this.repo.findOneOrFail({ where: { activeKey } });
      return {
        jobId: duplicate.id,
        status: duplicate.status,
        success: true,
        message: 'Задача уже в очереди',
      };
    }
  }

  async tick() {
    if (this.processing || this.stopping) return;
    this.processing = true;
    const runner = this.db.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const rows = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [OPERATION_LOCK],
      )) as { locked: boolean }[];
      locked = rows[0]?.locked === true;
      if (!locked) return;
      this.lease = runner;
      // Owning the session lock proves no previous worker is still executing.
      // Never replay an interrupted mutation automatically: its remote outcome may be unknown.
      await this.repo.update(
        { status: 'running' },
        {
          status: 'interrupted',
          activeKey: null,
          finishedAt: new Date(),
          message:
            'Процесс был прерван. Проверьте результат на ноде перед повторным запуском.',
        },
      );
      const job = await this.repo
        .createQueryBuilder('operation')
        .addSelect('operation.payload')
        .where('operation.status = :status', { status: 'queued' })
        .andWhere('operation.job = true')
        .orderBy('operation.scheduledAt', 'ASC')
        .addOrderBy('operation.id', 'ASC')
        .getOne();
      if (!job) return;
      const handler = this.handlers.get(job.kind);
      if (!handler) {
        await this.repo.update(job.id, {
          status: 'failed',
          activeKey: null,
          finishedAt: new Date(),
          message: 'Обработчик задачи недоступен в текущей версии приложения.',
        });
        return;
      }
      this.current = job;
      await this.repo.update(job.id, {
        status: 'running',
        startedAt: job.startedAt || new Date(),
        message: 'Выполняется',
      });
      try {
        const result = await handler(job.payload?.args || []);
        const failure =
          (result as { success?: boolean } | null)?.success === false;
        // Persist only the response fields used by the UI, never shell output or credentials.
        const value = result as {
          success?: boolean;
          message?: string;
          affected?: number;
        } | null;
        const safeResult = value
          ? {
              success: value.success,
              message:
                typeof value.message === 'string'
                  ? value.message.slice(0, 1000)
                  : undefined,
              affected: value.affected,
            }
          : null;
        await this.repo.update(job.id, {
          status: failure ? 'failed' : 'success',
          activeKey: null,
          finishedAt: new Date(),
          result: safeResult,
          message: safeResult?.message || 'Выполнено',
        });
      } catch (error) {
        if (error instanceof OperationYield) {
          await this.repo.update(job.id, {
            status: 'queued',
            scheduledAt: () => 'clock_timestamp()',
          });
          return;
        }
        const status = error instanceof HttpException ? error.getStatus() : 500;
        const response =
          error instanceof HttpException && status < 500
            ? error.getResponse()
            : {
                message:
                  'Ошибка выполнения. Проверьте доступность нод и настройки подключения.',
              };
        await this.repo.update(job.id, {
          status: 'failed',
          activeKey: null,
          finishedAt: new Date(),
          errorStatus: status,
          errorResponse: response,
          message:
            typeof response === 'string'
              ? response
              : String(
                  (response as { message?: unknown }).message ||
                    'Ошибка выполнения',
                ),
        });
        this.logger.error(`Operation ${job.id} failed (${job.kind})`);
      } finally {
        this.current = undefined;
      }
    } catch (error) {
      this.logger.error(
        `Background worker: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.current = undefined;
      if (this.lease === runner) this.lease = undefined;
      try {
        if (locked)
          await runner.query('SELECT pg_advisory_unlock($1)', [OPERATION_LOCK]);
      } catch {
        this.logger.warn('Worker database session lost');
      }
      try {
        await runner.release();
      } catch {
        this.logger.warn('Worker connection release failed');
      }
      this.processing = false;
    }
  }

  async audited<T>(
    kind: string,
    title: string,
    subject: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const runner = this.db.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const rows = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [OPERATION_LOCK],
      )) as { locked: boolean }[];
      locked = rows[0]?.locked === true;
      if (!locked)
        throw new ConflictException(
          'Выполняется другая операция. Дождитесь её завершения в Журнале.',
        );
      this.lease = runner;
      const entry = await this.repo.save(
        this.repo.create({
          kind,
          title,
          subject,
          status: 'running',
          startedAt: new Date(),
        }),
      );
      try {
        const result = await action();
        await this.repo.update(entry.id, {
          status: 'success',
          finishedAt: new Date(),
          message: 'Выполнено',
        });
        return result;
      } catch (error) {
        await this.repo.update(entry.id, {
          status: 'failed',
          finishedAt: new Date(),
          message:
            'Операция не выполнена. Проверьте данные и доступность ноды.',
        });
        throw error;
      }
    } finally {
      if (this.lease === runner) this.lease = undefined;
      try {
        if (locked)
          await runner.query('SELECT pg_advisory_unlock($1)', [OPERATION_LOCK]);
      } catch {
        this.logger.warn('Audit database session lost');
      }
      try {
        await runner.release();
      } catch {
        this.logger.warn('Audit connection release failed');
      }
    }
  }

  async progress(completed: number, total: number, message: string) {
    await this.assertOwnership();
    if (this.current)
      await this.repo.update(this.current.id, {
        completed,
        total,
        message: message.slice(0, 1000),
      });
  }
  get inBackground() {
    return Boolean(this.current);
  }
  resumeCheckpoint() {
    return this.current?.payload?.checkpoint;
  }
  async checkpoint(cursor: string, completed: number, failed: number) {
    await this.assertOwnership();
    if (!this.current) return;
    this.current.payload = {
      ...this.current.payload,
      args: this.current.payload?.args || [],
      checkpoint: { cursor, completed, failed },
    };
    await this.repo.update(this.current.id, { payload: this.current.payload });
  }
  yieldToQueue(): never {
    throw new OperationYield();
  }
  async note(message: string) {
    await this.assertOwnership();
    if (this.current)
      await this.repo.update(this.current.id, {
        message: message.slice(0, 1000),
      });
  }
  async assertOwnership() {
    // A lost lock connection must stop further remote mutations on this worker.
    if (this.lease) await this.lease.query('SELECT 1');
  }
  async record(
    kind: string,
    title: string,
    status: OperationStatus,
    message: string,
    subject = '',
  ) {
    await this.repo.save(
      this.repo.create({
        kind,
        title,
        status,
        subject: subject.slice(0, 200),
        message: message.slice(0, 1000),
        parentId: this.current?.id || null,
        finishedAt: new Date(),
      }),
    );
  }
  async list(page = 0, status?: OperationStatus, kind?: string) {
    const where = { ...(status ? { status } : {}), ...(kind ? { kind } : {}) };
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: page * 20,
      take: 20,
    });
    return { items, total };
  }
  async get(id: string) {
    const operation = await this.repo
      .createQueryBuilder('operation')
      .addSelect(['operation.result', 'operation.errorResponse'])
      .where('operation.id = :id', { id })
      .getOne();
    if (!operation) throw new NotFoundException('Задача не найдена');
    return operation;
  }
  async prune() {
    await this.repo.delete({
      finishedAt: LessThan(new Date(Date.now() - 30 * 86400000)),
      activeKey: IsNull(),
    });
    // Keep storage bounded even with frequent retries or a large subscription fleet.
    await this.repo.query(
      'DELETE FROM operation WHERE id IN (SELECT id FROM operation WHERE "finishedAt" IS NOT NULL ORDER BY "createdAt" DESC OFFSET 50000)',
    );
  }
}
