import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export class ExceptionItemNotFoundError extends NotFoundException {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
  }
}

export class ItemNotIssuableError extends ConflictException {
  constructor(itemId: string) {
    super(`Item must be SORTED or PROCESSING to raise an issue: ${itemId}`);
  }
}

export class FlowTemplateNotFoundError extends NotFoundException {
  constructor(flowCode: string) {
    super(`Exception flow template not found: ${flowCode}`);
  }
}

export class ApprovalRequestNotFoundError extends NotFoundException {
  constructor(id: string) {
    super(`Approval request not found: ${id}`);
  }
}

export class ApprovalRequestAlreadyResolvedError extends ConflictException {
  constructor() {
    super('Approval request is already resolved.');
  }
}

export class ApprovalRequestForbiddenError extends ForbiddenException {
  constructor() {
    super('You do not own this approval request.');
  }
}

export class PendingRouteChangeExistsError extends ConflictException {
  constructor(itemId: string) {
    super(`Item already has a pending route change request: ${itemId}`);
  }
}

export class ExceptionFlowActiveError extends ConflictException {
  constructor(itemId: string) {
    super(`Item has an active exception flow: ${itemId}`);
  }
}

export class RouteChangeRequestNotFoundError extends NotFoundException {
  constructor(id: string) {
    super(`Route change request not found: ${id}`);
  }
}

export class RouteChangeRequestAlreadyResolvedError extends ConflictException {
  constructor() {
    super('Route change request is already resolved.');
  }
}

export class RouteChangeRequestForbiddenError extends ForbiddenException {
  constructor() {
    super('You do not own this route change request.');
  }
}
