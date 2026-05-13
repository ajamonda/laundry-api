import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

export class BillingRequestNotFoundError extends DomainError {
  readonly code = 'BILLING_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Billing request not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}

export class BillingAlreadyResolvedError extends DomainError {
  readonly code = 'BILLING_ALREADY_RESOLVED';
  constructor(id: string) {
    super(`Billing request is already resolved: ${id}`, HttpStatus.CONFLICT);
  }
}

export class BillingRequestForbiddenError extends DomainError {
  readonly code = 'BILLING_REQUEST_FORBIDDEN';
  constructor() {
    super('This billing request does not belong to you.', HttpStatus.FORBIDDEN);
  }
}
