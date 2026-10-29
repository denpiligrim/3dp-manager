import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Res,
  Req,
  Inject,
  Query,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response, Request } from 'express';
import * as QRCode from 'qrcode';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Public } from '../auth/public.decorator';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { generateSubscriptionHtmlWithQr } from './templates/subscription.template';
import { buildHappRoutingLink } from '../subscriptions/happ-routing';
import { buildIncyRoutingLink } from '../subscriptions/incy-routing';

@Controller()
export class ClientController {
  private readonly logger = new Logger(ClientController.name);

  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(Tunnel)
    private tunnelRepo: Repository<Tunnel>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Public()
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Get('bus/:uuid')
  async getSubscription(
    @Param('uuid') uuid: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sub = await this.subRepo.findOne({
      where: { uuid },
      relations: ['inbounds'],
    });

    if (!sub || !sub.isEnabled) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }

    const links =
      sub.inbounds?.map((i) => i.link).filter((l) => l && l.length > 0) || [];

    const plainTextList = [...this.getRoutingLinks(sub), ...links].join('\n');
    const base64Config = Buffer.from(plainTextList).toString('base64');

    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/.test(userAgent);

    if (!isBrowser) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(base64Config);
    } else {
      const currentUrl = `${req.protocol}://${req.get('host')}/bus/${uuid}`;

      const cacheKey = `qr_${uuid}`;

      let qrDataUrl = await this.cacheManager.get<string>(cacheKey);

      if (!qrDataUrl) {
        qrDataUrl = await QRCode.toDataURL(currentUrl, {
          width: 300,
          margin: 2,
        });

        await this.cacheManager.set(cacheKey, qrDataUrl, 86400000);
      } else {
        this.logger.debug(`QR loaded from cache for ${uuid}`);
      }

      const html = generateSubscriptionHtmlWithQr(
        currentUrl,
        qrDataUrl,
        base64Config,
        sub.name,
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  }

  @Public()
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Get('bus/:uuid/:tunnelId')
  async getRelaySubscription(
    @Param('uuid') uuid: string,
    @Param('tunnelId') tunnelId: string,
    @Query('format') format: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tunnel = await this.tunnelRepo.findOne({ where: { id: +tunnelId } });
    if (!tunnel) {
      return res.status(HttpStatus.NOT_FOUND).send('Relay server not found');
    }

    const relayHost = tunnel.domain || tunnel.ip;

    const sub = await this.subRepo.findOne({
      where: { uuid },
      relations: ['inbounds'],
    });

    if (!sub || !sub.isEnabled) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }

    const links =
      sub.inbounds
        ?.filter((i) => i.link && i.link.length > 0)
        .map((i) => {
          if (i.protocol === 'custom') {
            return i.link;
          }
          return this.patchLink(i.link, relayHost);
        }) || [];

    const plainTextList = [...this.getRoutingLinks(sub), ...links].join('\n');
    const base64Config = Buffer.from(plainTextList).toString('base64');

    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/.test(userAgent);

    if (!isBrowser) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(base64Config);
    } else {
      const currentUrl = `${req.protocol}://${req.get('host')}/bus/${uuid}/${tunnelId}`;

      const cacheKey = `qr_${uuid}_${relayHost || 'direct'}`;

      let qrDataUrl = await this.cacheManager.get<string>(cacheKey);

      if (!qrDataUrl) {
        qrDataUrl = await QRCode.toDataURL(currentUrl, {
          width: 300,
          margin: 2,
        });

        await this.cacheManager.set(cacheKey, qrDataUrl, 86400000);
      } else {
        this.logger.debug(`QR loaded from cache for ${uuid}`);
      }

      const html = generateSubscriptionHtmlWithQr(
        currentUrl,
        qrDataUrl,
        base64Config,
        sub.name,
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  }

  private getRoutingLinks(sub: Subscription): string[] {
    return (sub.inboundsConfig || [])
      .filter(
        (config) =>
          config.type === 'happ-routing' || config.type === 'incy-routing',
      )
      .flatMap((config) => {
        try {
          return [
            config.type === 'incy-routing'
              ? buildIncyRoutingLink(config.routingProfile)
              : buildHappRoutingLink(config.routingProfile),
          ];
        } catch {
          this.logger.warn(`Skipping invalid ${config.type} profile`);
          return [];
        }
      });
  }

  private patchLink(link: string, newHost: string): string {
    if (link.startsWith('vmess://')) {
      try {
        const base64Part = link.substring(8);
        const jsonStr = Buffer.from(base64Part, 'base64').toString('utf-8');
        const config = JSON.parse(jsonStr) as { add: string };

        config.add = newHost;

        const newJsonStr = JSON.stringify(config);
        const newBase64 = Buffer.from(newJsonStr).toString('base64');
        return `vmess://${newBase64}`;
      } catch {
        return link;
      }
    } else if (
      link.startsWith('vless://') ||
      link.startsWith('trojan://') ||
      link.startsWith('hy2://')
    ) {
      return link.replace(/@.*?:/, `@${newHost}:`);
    } else if (link.startsWith('ss://')) {
      if (link.includes('@')) {
        return link.replace(/@.*?:/, `@${newHost}:`);
      }
      return link;
    }

    return link;
  }
}
