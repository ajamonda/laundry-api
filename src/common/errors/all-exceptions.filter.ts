import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Response } from 'express';
import { classifyException } from './classify-exception';

/**
 * Global exception filter. Owns the wire shape of every HTTP error response.
 *
 * Response body (always):
 *
 *     { "code": string, "message": string, "statusCode": number }
 *
 * The classification policy lives in `classifyException` (pure, unit-
 * tested). This filter only handles the side-effects: logging and writing
 * the response.
 *
 * Mapping summary (see classify-exception.ts for the full contract):
 *
 *   - DomainError              → subclass code/message/status
 *   - HttpException (built-in) → status from exception; code `HTTP_<STATUS>`
 *   - Prisma P2025             → 404 `RESOURCE_NOT_FOUND`
 *   - Prisma P2002             → 409 `UNIQUE_CONFLICT`
 *                                (defensive net — `withIdempotency` should
 *                                have caught this at the repo layer)
 *   - Prisma other             → 500 `INTERNAL_DB_ERROR` (masked)
 *   - anything else            → 500 `INTERNAL_ERROR` (masked)
 *
 * The masking on Prisma-other and unknown throws is intentional: Prisma
 * messages leak column names, stack traces leak file paths. Never widen
 * the filter to surface those.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const { status, code, message, logLevel, logOriginal } =
      classifyException(exception);

    if (logOriginal) {
      const meta = `${request?.method ?? '?'} ${request?.url ?? '?'} → ${status} ${code}`;
      if (logLevel === 'error') {
        this.logger.error(
          meta,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else {
        this.logger.warn(`${meta}: ${this.safeMessage(exception)}`);
      }
    }

    response.status(status).json({ code, message, statusCode: status });
  }

  private safeMessage(exception: unknown): string {
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }
}
