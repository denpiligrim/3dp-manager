import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { RequestMethod, Logger, LogLevel } from '@nestjs/common';
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './client/client.exception-filter';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Настройка уровня логирования из переменной окружения
  const configuredLevel = configService.get<string>('LOG_LEVEL', 'error');
  const logLevels: LogLevel[] =
    configuredLevel === 'debug'
      ? ['error', 'warn', 'log', 'debug']
      : configuredLevel === 'verbose'
        ? ['error', 'warn', 'log', 'debug', 'verbose']
        : ['error', 'warn', 'log'];

  app.useLogger(logLevels);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.debug(
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`,
      );
    });
    next();
  });

  app.set('trust proxy', 1);

  // Cookie parser для работы с httpOnly cookies
  const cookieParserFactory = cookieParser as unknown as () => RequestHandler;
  app.use(cookieParserFactory());

  const authService = app.get(AuthService);
  await authService.seedAdmin();

  const allowedOrigins = (
    configService.get<string>('ALLOWED_ORIGINS', '') || ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  logger.log(
    `CORS origins: ${
      allowedOrigins.length > 0
        ? allowedOrigins.join(', ')
        : 'all origins allowed'
    }`,
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, из мобильных приложений или curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'bus/:uuid', method: RequestMethod.GET },
      { path: 'bus/:uuid/:tunnelId', method: RequestMethod.GET },
    ],
  });

  // Serve static assets from the React client's build directory
  const clientDistPath = path.join(process.cwd(), 'client', 'dist');
  app.use(express.static(clientDistPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/bus')
    ) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      next();
    }
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Application started on port ${port}`);
}
void bootstrap();
