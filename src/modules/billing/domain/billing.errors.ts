import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export class BillingRequestNotFoundError extends NotFoundException {
  constructor(id: string) {
    super(`Billing request not found: ${id}`);
  }
}

export class BillingAlreadyResolvedError extends ConflictException {
  constructor(id: string) {
    super(`Billing request is already resolved: ${id}`);
  }
}

export class BillingRequestForbiddenError extends ForbiddenException {
  constructor() {
    super('This billing request does not belong to you.');
  }
}
