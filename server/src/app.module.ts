import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { Setting } from './settings/entities/setting.entity';
import { Domain } from './domains/entities/domain.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { Inbound } from './inbounds/entities/inbound.entity';
import { XuiModule } from './xui/xui.module';
import { InboundsModule } from './inbounds/inbounds.module';
import { RotationModule } from './rotation/rotation.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { DomainsModule } from './domains/domains.module';
import { SettingsModule } from './settings/settings.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ClientModule } from './client/client.module';
import { TunnelsModule } from './tunnels/tunnels.module';
import { Tunnel } from './tunnels/entities/tunnel.entity';
import { SessionModule } from './session/session.module';
import { Node } from './nodes/entities/node.entity';
import { NodesModule } from './nodes/nodes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000,
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [Setting, Domain, Subscription, Inbound, Tunnel, Node],
      synchronize: true,
      migrationsRun: false,
    }),
    SessionModule,
    XuiModule,
    InboundsModule,
    RotationModule,
    SubscriptionsModule,
    DomainsModule,
    SettingsModule,
    AuthModule,
    ClientModule,
    TunnelsModule,
    NodesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
