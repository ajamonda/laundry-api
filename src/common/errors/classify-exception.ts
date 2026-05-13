import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from './domain-error';

/**
 * Result of classifying an arbitrary thrown value into an HTTP error
 * response shape. Consumed by `AllExceptionsFilter`; extracted as a pure
 * function so it can be unit-tested without spinning up Nest.
 */
export type ClassifiedError = {
  status: number;
  code: string;
  message: string;
  logLevel: 'warn' | 'error' | 'silent';
  logOriginal: boolean;
};

/**
 * Map any thrown value to a `ClassifiedError`. See the docstring on
 * `AllExceptionsFilter` for the policy rationale; this function MUST
 * implement that policy literally.
 *
 *   - `DomainError`                   → subclass `code` / `status` / `message`
 *   - `HttpException` (built-in)       → status from exception; code = HTTP_<STATUS>
 *   - `Prisma.PrismaClientKnownRequestError`
 *       - P2025                       → 404 RESOURCE_NOT_FOUND
 *       - P2002                       → 409 UNIQUE_CONFLICT
 *       - other                       → 500 INTERNAL_DB_ERROR (masked)
 *   - anything else                    → 500 INTERNAL_ERROR (masked)
 *
 * Pure: no I/O, no logging, no Response writes. Logging and serialisation
 * happen in the filter.
 */
export function classifyException(exception: unknown): ClassifiedError {
  if (exception instanceof DomainError) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      logLevel: 'silent',
      logOriginal: false,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message = extractHttpMessage(body, exception.message);
    return {
      status,
      code: `HTTP_${status}`,
      message,
      logLevel: 'silent',
      logOriginal: false,
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
        logLevel: 'warn',
        logOriginal: true,
      };
    }
    if (exception.code === 'P2002') {
      return {
        status: HttpStatus.CONFLICT,
        code: 'UNIQUE_CONFLICT',
        message: 'Unique constraint violation',
        logLevel: 'warn',
        logOriginal: true,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_DB_ERROR',
      message: 'Internal server error',
      logLevel: 'error',
      logOriginal: true,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    logLevel: 'error',
    logOriginal: true,
  };
}

function extractHttpMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string') return body;
  const maybe = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(maybe)) return maybe.join('; ');
  if (typeof maybe === 'string') return maybe;
  return fallback;
}
