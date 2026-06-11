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
import { AddNodesAndNodeRelations1765960000000 } from './migrations/1765960000000-add-nodes-and-node-relations';
import { AddNodeIpFlagAndInboundLabels1770000000000 } from './migrations/1770000000000-add-node-ip-flag-and-inbound-labels';
import { AddNodeDomain1770000000001 } from './migrations/1770000000001-add-node-domain';

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
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Setting, Domain, Subscription, Inbound, Tunnel, Node],
      migrations: [
        AddNodesAndNodeRelations1765960000000,
        AddNodeIpFlagAndInboundLabels1770000000000,
        AddNodeDomain1770000000001,
      ],
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
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
