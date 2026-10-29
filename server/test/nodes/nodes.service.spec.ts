import { Repository } from 'typeorm';
import { NodesService } from 'src/nodes/nodes.service';
import { Node } from 'src/nodes/entities/node.entity';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { Inbound } from 'src/inbounds/entities/inbound.entity';
import { XuiService } from 'src/xui/xui.service';

describe('NodesService', () => {
  const createNodeRepo = (getOne: jest.Mock) => ({
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    })),
    count: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  });

  const createService = (nodeRepo: ReturnType<typeof createNodeRepo>) => {
    const subscriptionsRepo = {
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    };
    const tunnelsRepo = {
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
      delete: jest.fn(),
    };
    const inboundsRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    const xuiService = {
      deleteInbound: jest.fn().mockResolvedValue(true),
    };

    return {
      service: new NodesService(
        nodeRepo as unknown as Repository<Node>,
        subscriptionsRepo as unknown as Repository<Subscription>,
        tunnelsRepo as unknown as Repository<Tunnel>,
        inboundsRepo as unknown as Repository<Inbound>,
        xuiService as unknown as XuiService,
      ),
      subscriptionsRepo,
      tunnelsRepo,
      inboundsRepo,
      xuiService,
    };
  };

  it('deletes the main node and makes the next node main', async () => {
    const mainNode = { id: 'main', isMain: true } as Node;
    const nextNode = { id: 'next', isMain: false } as Node;
    const getOne = jest
      .fn()
      .mockResolvedValueOnce(mainNode)
      .mockResolvedValueOnce(null);
    const nodeRepo = createNodeRepo(getOne);
    nodeRepo.count.mockResolvedValue(2);
    nodeRepo.findOne.mockResolvedValue(nextNode);
    nodeRepo.save.mockResolvedValue(nextNode);
    const { service } = createService(nodeRepo);

    const result = await service.remove('main');

    expect(result).toEqual({ success: true });
    expect(nodeRepo.remove).toHaveBeenCalledWith(mainNode);
    expect(nodeRepo.findOne).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
    });
    expect(nextNode.isMain).toBe(true);
    expect(nodeRepo.save).toHaveBeenCalledWith(nextNode);
  });

  it('can force-delete an unavailable node without calling its panel', async () => {
    const node = { id: 'offline', isMain: false } as Node;
    const nodeRepo = createNodeRepo(jest.fn().mockResolvedValue(node));
    nodeRepo.count.mockResolvedValue(2);
    const { service, inboundsRepo, xuiService } = createService(nodeRepo);
    xuiService.deleteInbound.mockResolvedValue(false);
    await service.remove('offline', true);
    expect(xuiService.deleteInbound).not.toHaveBeenCalled();
    expect(inboundsRepo.delete).toHaveBeenCalledWith({ nodeId: 'offline' });
    expect(nodeRepo.remove).toHaveBeenCalledWith(node);
  });

  it.each([false, true])('deletes all subscriptions when the last node is removed (force=%s)', async (force) => {
    const node = { id: 'last', isMain: true } as Node;
    const nodeRepo = createNodeRepo(jest.fn().mockResolvedValueOnce(node).mockResolvedValue(null));
    nodeRepo.count.mockResolvedValue(1);
    const { service, subscriptionsRepo, tunnelsRepo, inboundsRepo, xuiService } = createService(nodeRepo);
    inboundsRepo.find.mockResolvedValue([{ id: 1, xuiId: 101, nodeId: 'last' }]);

    await service.remove('last', force);

    expect(subscriptionsRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(subscriptionsRepo.createQueryBuilder.mock.results[0].value.delete).toHaveBeenCalled();
    expect(subscriptionsRepo.createQueryBuilder.mock.results[0].value.execute).toHaveBeenCalled();
    expect(tunnelsRepo.createQueryBuilder.mock.results[0].value.execute).toHaveBeenCalled();
    expect(nodeRepo.remove).toHaveBeenCalledWith(node);
    expect(xuiService.deleteInbound).toHaveBeenCalledTimes(force ? 0 : 1);
  });

  it('preserves subscriptions when another node remains', async () => {
    const node = { id: 'one', isMain: false } as Node;
    const nodeRepo = createNodeRepo(jest.fn().mockResolvedValue(node));
    nodeRepo.count.mockResolvedValue(2);
    const { service, subscriptionsRepo } = createService(nodeRepo);

    await service.remove('one');

    expect(subscriptionsRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(nodeRepo.remove).toHaveBeenCalledWith(node);
  });

  it('keeps the node when normal remote cleanup fails', async () => {
    const node = { id: 'offline', isMain: false } as Node;
    const nodeRepo = createNodeRepo(jest.fn().mockResolvedValue(node));
    nodeRepo.count.mockResolvedValue(2);
    const { service, inboundsRepo, xuiService } = createService(nodeRepo);
    inboundsRepo.find.mockResolvedValue([{ id: 1, xuiId: 101 }]);
    xuiService.deleteInbound.mockResolvedValue(false);
    await expect(service.remove('offline')).rejects.toThrow(
      'Failed to delete inbound',
    );
    expect(nodeRepo.remove).not.toHaveBeenCalled();
    expect(inboundsRepo.delete).not.toHaveBeenCalled();
  });

  it('uses node credentials when deleting node inbounds', async () => {
    const mainNode = { id: 'main', isMain: true } as Node;
    const getOne = jest
      .fn()
      .mockResolvedValueOnce(mainNode)
      .mockResolvedValueOnce(null);
    const nodeRepo = createNodeRepo(getOne);
    nodeRepo.count.mockResolvedValue(1);
    nodeRepo.findOne.mockResolvedValue(null);
    const { service, inboundsRepo, xuiService } = createService(nodeRepo);
    inboundsRepo.find.mockResolvedValue([
      { id: 1, xuiId: 101, nodeId: 'main' },
    ]);

    await service.remove('main');

    expect(xuiService.deleteInbound).toHaveBeenCalledWith(101, mainNode);
  });
});
