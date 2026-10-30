import {
  BadRequestException,
  Controller,
  INestApplication,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { Operation } from 'src/operations/operation.entity';
import { OperationsModule } from 'src/operations/operations.module';
import { OperationsService } from 'src/operations/operations.service';
import { OperationsWorker } from 'src/operations/operations.worker';
import {
  BackgroundTask,
  JournalAction,
} from 'src/operations/operations.decorators';
import { AddOperations1793300000000 } from 'src/migrations/1793300000000-add-operations';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { Inbound } from 'src/inbounds/entities/inbound.entity';
import { Node } from 'src/nodes/entities/node.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { Domain } from 'src/domains/entities/domain.entity';
import { RotationService } from 'src/rotation/rotation.service';
import { InboundBuilderService } from 'src/inbounds/inbound-builder.service';
import { XuiService } from 'src/xui/xui.service';

let gate: Promise<void> | undefined;
let starts = 0;
@Controller('probe')
class ProbeController {
  @Post('job/:id')
  @BackgroundTask('test.job', 'Test task', ['param:id', 'query:force'])
  async job(@Param('id') id: string, @Query('force') force?: string) {
    starts++;
    if (gate) await gate;
    if (id === 'failure')
      throw new BadRequestException({
        code: 'INBOUND_DELETE_FAILED',
        message: 'Panel unavailable',
      });
    return {
      success: true,
      message: `${id}:${force}`,
      output: 'must-not-be-stored',
    };
  }
  @Post('create')
  @JournalAction('test.create', 'Create resource')
  create() {
    return { id: 'created', token: 'must-not-be-stored' };
  }
}

const dbDescribe = process.env.OPERATIONS_TEST_DB_PORT
  ? describe
  : describe.skip;
dbDescribe('operations on isolated PostgreSQL', () => {
  let app: INestApplication;
  let db: DataSource;
  let repo: Repository<Operation>;
  let operations: OperationsService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: '127.0.0.1',
          port: Number(process.env.OPERATIONS_TEST_DB_PORT),
          username: 'operations_test',
          password: 'operations-test-only',
          database: 'operations_test',
          entities: [
            Operation,
            Subscription,
            Inbound,
            Node,
            Tunnel,
            Setting,
            Domain,
          ],
          synchronize: true,
        }),
        OperationsModule,
      ],
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    app.get(OperationsWorker).onApplicationShutdown(); // deterministic ticks in tests
    db = app.get(DataSource);
    repo = db.getRepository(Operation);
    operations = app.get(OperationsService);
  });
  beforeEach(async () => {
    await repo.clear();
    gate = undefined;
    starts = 0;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('migrates idempotently and matches the ORM schema', async () => {
    await db.query(
      'CREATE TABLE IF NOT EXISTS inbound (id integer PRIMARY KEY)',
    );
    const runner = db.createQueryRunner();
    const migration = new AddOperations1793300000000();
    try {
      await migration.down(runner);
      await migration.up(runner);
      await migration.up(runner);
      const queued = await operations.enqueue('test.job', 'Migration test', [
        'migrated',
        null,
      ]);
      await operations.tick();
      expect((await operations.get(queued.jobId)).status).toBe('success');
    } finally {
      await runner.release();
    }
  });

  it('returns 202, deduplicates simultaneous requests, and preserves controller arguments', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app.getHttpServer()).post('/probe/job/one?force=true'),
      ),
    );
    expect(responses.every((response) => response.status === 202)).toBe(true);
    const ids = new Set(
      responses.map((response) => response.body.jobId as string),
    );
    expect(ids.size).toBe(1);
    expect(starts).toBe(0);
    await operations.tick();
    const result = await operations.get([...ids][0]);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ success: true, message: 'one:true' });
    expect(starts).toBe(1);
    const publicList = await operations.list();
    expect(JSON.stringify(publicList)).not.toContain('must-not-be-stored');
    expect(publicList.items[0].payload).toBeUndefined();
  });

  it('runs one worker at a time and rejects conflicting synchronous changes', async () => {
    let release!: () => void;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await operations.enqueue('test.job', 'First', ['first']);
    await operations.enqueue('test.job', 'Second', ['second']);
    const firstTick = operations.tick();
    try {
      for (let i = 0; i < 100 && starts === 0; i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(starts).toBe(1);
      const secondWorker = new OperationsService(repo, db);
      secondWorker.register('test.job', async () => {
        starts++;
      });
      await secondWorker.tick();
      expect(starts).toBe(1);
      await request(app.getHttpServer()).post('/probe/create').expect(409);
    } finally {
      release();
      await firstTick;
      gate = undefined;
    }
    await operations.tick();
    expect(starts).toBe(2);
  });

  it('marks interrupted mutations instead of replaying them, but executes persisted queued jobs', async () => {
    const interrupted = await repo.save(
      repo.create({
        kind: 'test.job',
        title: 'Interrupted',
        job: true,
        status: 'running',
        activeKey: 'test.job:old',
        payload: { args: ['old'] },
      }),
    );
    const queued = await operations.enqueue('test.job', 'Queued', ['new']);
    const restarted = new OperationsService(repo, db);
    restarted.register('test.job', async () => {
      starts++;
      return { success: true };
    });
    await restarted.tick();
    expect((await operations.get(interrupted.id)).status).toBe('interrupted');
    expect((await operations.get(queued.jobId)).status).toBe('success');
    expect(starts).toBe(1);
  });

  it('persists structured deletion errors and unlocks subsequent jobs', async () => {
    const failure = await operations.enqueue('test.job', 'Failure', [
      'failure',
    ]);
    await operations.tick();
    const result = await operations.get(failure.jobId);
    expect(result.status).toBe('failed');
    expect(result.errorStatus).toBe(400);
    expect(result.errorResponse).toEqual({
      code: 'INBOUND_DELETE_FAILED',
      message: 'Panel unavailable',
    });
    await request(app.getHttpServer()).post('/probe/create').expect(201);
    expect(
      (await operations.list(0, 'success', 'test.create')).items,
    ).toHaveLength(1);
  });

  it('checkpoints a batch and lets another queued action run before its next slice', async () => {
    const order: string[] = [];
    operations.register('test.batch', async () => {
      const checkpoint = operations.resumeCheckpoint();
      order.push(checkpoint ? 'slice-2' : 'slice-1');
      if (!checkpoint) {
        await operations.checkpoint('completed-subscription', 1, 0);
        operations.yieldToQueue();
      }
      expect(checkpoint?.completed).toBe(1);
      return { success: true };
    });
    operations.register('test.delete', async () => {
      order.push('delete');
      return { success: true };
    });
    const batch = await operations.enqueue('test.batch', 'Batch');
    await operations.enqueue('test.delete', 'Delete');
    await operations.tick();
    expect((await operations.get(batch.jobId)).status).toBe('queued');
    await operations.tick();
    await operations.tick();
    expect(order).toEqual(['slice-1', 'delete', 'slice-2']);
    expect((await operations.get(batch.jobId)).status).toBe('success');
  });

  it('keeps failed replacements pending and cleans them up after a successful rotation', async () => {
    const subs = db.getRepository(Subscription);
    const inbounds = db.getRepository(Inbound);
    const subscription = await subs.save(
      subs.create({
        name: 'Rollback test',
        uuid: 'rollback-test',
        inboundsConfig: [
          { type: 'vless-xhttp-get', port: 22001 },
          { type: 'vless-xhttp-get', port: 22002 },
        ],
      }),
    );
    const old = await inbounds.save(
      inbounds.create({
        xuiId: 100,
        port: 22000,
        protocol: 'vless',
        link: 'vless://old',
        subscription,
      }),
    );
    const xui = {
      addInbound: jest
        .fn()
        .mockResolvedValueOnce(101)
        .mockResolvedValueOnce(null),
      deleteInbound: jest.fn().mockResolvedValue(false),
    };
    const rotation = new RotationService(
      subs,
      inbounds,
      db.getRepository(Domain),
      db.getRepository(Setting),
      db.getRepository(Node),
      db.getRepository(Tunnel),
      xui as unknown as XuiService,
      new InboundBuilderService(),
      operations,
    );
    const rotate = rotation as unknown as {
      rotateSubscription: (
        sub: Subscription,
        domains: Domain[],
        node: Node | null,
      ) => Promise<boolean>;
    };
    let current = await subs.findOneOrFail({
      where: { id: subscription.id },
      relations: ['inbounds'],
    });
    expect(await rotate.rotateSubscription(current, [], null)).toBe(false);
    const afterFailure = await inbounds.find({
      where: { subscription: { id: subscription.id } },
    });
    expect(afterFailure.find((item) => item.id === old.id)?.isPending).toBe(
      false,
    );
    expect(afterFailure.find((item) => item.xuiId === 101)?.isPending).toBe(
      true,
    );
    xui.addInbound
      .mockReset()
      .mockResolvedValueOnce(102)
      .mockResolvedValueOnce(103);
    xui.deleteInbound.mockReset().mockResolvedValue(true);
    current = await subs.findOneOrFail({
      where: { id: subscription.id },
      relations: ['inbounds'],
    });
    expect(await rotate.rotateSubscription(current, [], null)).toBe(true);
    const afterSuccess = await inbounds.find({
      where: { subscription: { id: subscription.id } },
    });
    expect(afterSuccess.map((item) => item.xuiId).sort()).toEqual([102, 103]);
    expect(afterSuccess.every((item) => item.isPending === false)).toBe(true);
    await subs.remove(subscription);
  });

  it('does not accumulate replacements when the panel accepts creation but keeps rejecting deletion', async () => {
    const subs = db.getRepository(Subscription),
      inbounds = db.getRepository(Inbound);
    const subscription = await subs.save(
      subs.create({
        name: 'Cleanup test',
        uuid: 'cleanup-test',
        inboundsConfig: [{ type: 'vless-xhttp-get', port: 23001 }],
      }),
    );
    await inbounds.save(
      inbounds.create({
        xuiId: 201,
        port: 23000,
        protocol: 'vless',
        link: 'vless://old',
        subscription,
      }),
    );
    const xui = {
      addInbound: jest.fn().mockResolvedValue(301),
      deleteInbound: jest.fn().mockResolvedValue(false),
    };
    const rotation = new RotationService(
      subs,
      inbounds,
      db.getRepository(Domain),
      db.getRepository(Setting),
      db.getRepository(Node),
      db.getRepository(Tunnel),
      xui as unknown as XuiService,
      new InboundBuilderService(),
      operations,
    );
    const rotate = rotation as unknown as {
      rotateSubscription: (
        sub: Subscription,
        domains: Domain[],
        node: Node | null,
      ) => Promise<boolean>;
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await subs.findOneOrFail({
        where: { id: subscription.id },
        relations: ['inbounds'],
      });
      expect(await rotate.rotateSubscription(current, [], null)).toBe(false);
    }
    expect(xui.addInbound).toHaveBeenCalledTimes(1);
    const records = await inbounds.find({
      where: { subscription: { id: subscription.id } },
    });
    expect(records).toHaveLength(2);
    expect(
      records.filter((item) => !item.isPending).map((item) => item.xuiId),
    ).toEqual([301]);
    await subs.remove(subscription);
  });
});
