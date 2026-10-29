import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { HttpExceptionFilter } from 'src/client/client.exception-filter';
import { SubscriptionsController } from 'src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { Node } from 'src/nodes/entities/node.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { XuiService } from 'src/xui/xui.service';

describe('Subscription deletion HTTP contract', () => {
  let app: INestApplication<App>;
  const subscription = { id: 'sub-1', inbounds: [{ xuiId: 101 }] };
  const subRepo = { findOne: jest.fn(), remove: jest.fn() };
  const xui = { deleteInbound: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    subRepo.findOne.mockResolvedValue(subscription);
    xui.deleteInbound.mockResolvedValue(false);
    const service = new SubscriptionsService(
      subRepo as unknown as Repository<Subscription>,
      {} as Repository<Node>,
      {} as Repository<Tunnel>,
      xui as unknown as XuiService,
    );
    const module = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [{ provide: SubscriptionsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  it('preserves the error code through the global filter and accepts explicit force retry', async () => {
    await request(app.getHttpServer())
      .delete('/api/subscriptions/sub-1')
      .set('User-Agent', 'Mozilla/5.0')
      .expect(400)
      .expect(({ body }: { body: { code: string; message: string } }) => {
        expect(body.code).toBe('INBOUND_DELETE_FAILED');
        expect(body.message).toContain('101');
      });
    expect(subRepo.remove).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .delete('/api/subscriptions/sub-1?force=true')
      .expect(200);
    expect(subRepo.remove).toHaveBeenCalledWith(subscription);
  });
});
