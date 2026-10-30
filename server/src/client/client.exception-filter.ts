import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { generateErrorHtml } from '../client/templates/subscription.template';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message;

    const errorMessage = Array.isArray(message) ? message[0] : message;

    // Проверяем, что это браузер (не API запрос)
    const userAgent = request.headers['user-agent'] || '';
    const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/.test(userAgent);

    // Для endpoint подписки /bus/* возвращаем HTML
    if (isBrowser && request.url.includes('/bus/')) {
      const html = generateErrorHtml('Подписка не найдена', errorMessage);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.status(status).send(html);
    } else {
      // Для API запросов возвращаем JSON
      response.status(status).json({
        statusCode: status,
        message: errorMessage,
        ...(typeof exceptionResponse === 'object' &&
        typeof (exceptionResponse as { code?: unknown }).code === 'string'
          ? { code: (exceptionResponse as { code: string }).code }
          : {}),
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
