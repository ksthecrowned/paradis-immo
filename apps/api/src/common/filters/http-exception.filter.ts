import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  code?: string;
  message?: string | string[];
  [key: string]: unknown;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const errorBody = (typeof body === 'object' ? body : null) as ErrorBody | null;
    const message =
      typeof body === 'string'
        ? body
        : Array.isArray(errorBody?.message)
          ? errorBody.message.join('; ')
          : (errorBody?.message ?? exception.message);

    response.status(status).json({
      code: errorBody?.code ?? `HTTP_${status}`,
      message,
      details: typeof body === 'object' ? body : null,
    });
  }
}
