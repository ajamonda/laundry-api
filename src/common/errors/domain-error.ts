import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for ALL domain-specific errors thrown by use cases / repositories
 * / services in this codebase.
 *
 * Why this exists:
 *   - Tests, logs, and clients need a stable machine-readable discriminator
 *     that survives message wording changes (i18n, copy edits).
 *   - The HTTP response body is emitted by `AllExceptionsFilter` and includes
 *     `{ code, message, statusCode }`. The `code` is what callers branch on;
 *     the `message` is human-facing and may change without breaking contracts.
 *
 * Subclass contract:
 *   - `code` MUST be a stable SCREAMING_SNAKE_CASE identifier prefixed with
 *     the domain (e.g. `WASH_ITEM_NOT_TAGGABLE`, `BILLING_ALREADY_RESOLVED`).
 *   - `code` MUST never be renamed once shipped — it is part of the API.
 *   - Status code is selected via the protected static helpers below
 *     (`asConflict`, `asNotFound`, `asBadRequest`, `asForbidden`) so a
 *     subclass declaration stays short.
 *
 * Subclass example:
 *
 *     export class WashItemNotFoundError extends DomainError {
 *       readonly code = 'WASH_ITEM_NOT_FOUND';
 *       constructor(itemId: string) {
 *         super(`Item not found: ${itemId}`, HttpStatus.NOT_FOUND);
 *       }
 *     }
 */
export abstract class DomainError extends HttpException {
  abstract readonly code: string;

  constructor(message: string, status: HttpStatus) {
    // We intentionally pass a string here (not an object). The response body
    // is shaped by AllExceptionsFilter, which reads `this.code` directly off
    // the instance — keeping the constructor payload as a plain message means
    // standard NestJS logging / serialization still works if the filter is
    // ever bypassed.
    super(message, status);
  }
}
