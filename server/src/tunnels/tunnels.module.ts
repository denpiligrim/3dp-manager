import { Module } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { TunnelsController } from './tunnels.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { Setting } from '../settings/entities/setting.entity';
import { SshService } from './ssh.service';
import { Node } from '../nodes/entities/node.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tunnel, Setting, Node, Subscription]),
    DomainsModule,
  ],
  controllers: [TunnelsController],
  providers: [TunnelsService, SshService],
})
export class TunnelsModule {}
