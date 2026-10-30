import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { OPERATION, OperationDefinition } from './operations.decorators';
import { OperationsService } from './operations.service';

@Injectable()
export class OperationsWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private lastPrune = 0;
  private readonly logger = new Logger(OperationsWorker.name);
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly operations: OperationsService,
  ) {}
  onApplicationBootstrap() {
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as
        | Record<string, (...args: (string | null)[]) => Promise<unknown>>
        | undefined;
      if (!instance) continue;
      for (const method of this.scanner.getAllMethodNames(
        Object.getPrototypeOf(instance) as object,
      )) {
        const handler = instance[method];
        const definition = this.reflector.get<OperationDefinition>(
          OPERATION,
          handler,
        );
        if (definition?.background)
          this.operations.register(definition.kind, (args) =>
            handler.apply(instance, args),
          );
      }
    }
    this.timer = setInterval(() => {
      void this.operations.tick();
      if (Date.now() - this.lastPrune > 86400000) {
        this.lastPrune = Date.now();
        void this.operations
          .prune()
          .catch(() => this.logger.warn('Journal cleanup failed'));
      }
    }, 2000);
    this.timer.unref();
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
