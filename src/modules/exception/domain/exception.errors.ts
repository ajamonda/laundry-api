import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

export class ExceptionItemNotFoundError extends DomainError {
  readonly code = 'EXCEPTION_ITEM_NOT_FOUND';
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`, HttpStatus.NOT_FOUND);
  }
}

export class ItemNotIssuableError extends DomainError {
  readonly code = 'EXCEPTION_ITEM_NOT_ISSUABLE';
  constructor(itemId: string) {
    super(`Item must be SORTED or PROCESSING to raise an issue: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class FlowTemplateNotFoundError extends DomainError {
  readonly code = 'EXCEPTION_FLOW_TEMPLATE_NOT_FOUND';
  constructor(flowCode: string) {
    super(`Exception flow template not found: ${flowCode}`, HttpStatus.NOT_FOUND);
  }
}

export class ApprovalRequestNotFoundError extends DomainError {
  readonly code = 'EXCEPTION_APPROVAL_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Approval request not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}

export class ApprovalRequestAlreadyResolvedError extends DomainError {
  readonly code = 'EXCEPTION_APPROVAL_REQUEST_ALREADY_RESOLVED';
  constructor() {
    super('Approval request is already resolved.', HttpStatus.CONFLICT);
  }
}

export class ApprovalRequestForbiddenError extends DomainError {
  readonly code = 'EXCEPTION_APPROVAL_REQUEST_FORBIDDEN';
  constructor() {
    super('You do not own this approval request.', HttpStatus.FORBIDDEN);
  }
}

export class PendingRouteChangeExistsError extends DomainError {
  readonly code = 'EXCEPTION_PENDING_ROUTE_CHANGE_EXISTS';
  constructor(itemId: string) {
    super(`Item already has a pending route change request: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class ExceptionFlowActiveError extends DomainError {
  readonly code = 'EXCEPTION_FLOW_ACTIVE';
  constructor(itemId: string) {
    super(`Item has an active exception flow: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class RouteChangeRequestNotFoundError extends DomainError {
  readonly code = 'EXCEPTION_ROUTE_CHANGE_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Route change request not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}

export class RouteChangeRequestAlreadyResolvedError extends DomainError {
  readonly code = 'EXCEPTION_ROUTE_CHANGE_REQUEST_ALREADY_RESOLVED';
  constructor() {
    super('Route change request is already resolved.', HttpStatus.CONFLICT);
  }
}

export class RouteChangeRequestForbiddenError extends DomainError {
  readonly code = 'EXCEPTION_ROUTE_CHANGE_REQUEST_FORBIDDEN';
  constructor() {
    super('You do not own this route change request.', HttpStatus.FORBIDDEN);
  }
}
