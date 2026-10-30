import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operation } from './operation.entity';
import { OperationsService } from './operations.service';
import { OperationsWorker } from './operations.worker';
import { OperationsController } from './operations.controller';
import { OperationsInterceptor } from './operations.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Operation]), DiscoveryModule],
  controllers: [OperationsController],
  providers: [
    OperationsService,
    OperationsWorker,
    { provide: APP_INTERCEPTOR, useClass: OperationsInterceptor },
  ],
  exports: [OperationsService],
})
export class OperationsModule {}
