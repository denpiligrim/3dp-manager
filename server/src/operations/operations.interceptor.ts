import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { from, lastValueFrom } from 'rxjs';
import { OPERATION, OperationDefinition } from './operations.decorators';
import { OperationsService } from './operations.service';

@Injectable()
export class OperationsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly operations: OperationsService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const definition = this.reflector.get<OperationDefinition>(
      OPERATION,
      context.getHandler(),
    );
    if (!definition) return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    if (definition.background) {
      const args = (definition.args || []).map((source) => {
        const [location, key] = source.split(':');
        const value: unknown =
          location === 'param' ? request.params[key] : request.query[key];
        return typeof value === 'string' ? value.slice(0, 128) : null;
      });
      context.switchToHttp().getResponse<Response>().status(202);
      return from(
        this.operations.enqueue(definition.kind, definition.title, args),
      );
    }
    const body = request.body as { name?: unknown } | undefined;
    const subject = (
      typeof body?.name === 'string'
        ? body.name
        : String(request.params.id || '')
    ).slice(0, 200);
    return from(
      this.operations.audited(
        definition.kind,
        definition.title,
        subject,
        () => lastValueFrom(next.handle()) as Promise<unknown>,
      ),
    );
  }
}
