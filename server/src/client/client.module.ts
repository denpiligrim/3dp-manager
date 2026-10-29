import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientController } from './client.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Tunnel]),
    CacheModule.register(),
    SubscriptionsModule,
  ],
  controllers: [ClientController],
})
export class ClientModule {}
