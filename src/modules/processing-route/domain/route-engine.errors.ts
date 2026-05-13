import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

export class InvalidRouteCodeError extends DomainError {
  readonly code = 'ROUTE_INVALID_CODE';
  constructor(code: string) {
    super(`Processing route not found or inactive: ${code}`, HttpStatus.BAD_REQUEST);
  }
}

export class NoActivePlanError extends DomainError {
  readonly code = 'ROUTE_NO_ACTIVE_PLAN';
  constructor(orderItemId: string) {
    super(`No processing state found for item: ${orderItemId}`, HttpStatus.BAD_REQUEST);
  }
}

export class PlanAlreadyExistsError extends DomainError {
  readonly code = 'ROUTE_PLAN_ALREADY_EXISTS';
  constructor(orderItemId: string) {
    super(`Item already has an active processing plan: ${orderItemId}`, HttpStatus.CONFLICT);
  }
}

export class StepNotInProgressError extends DomainError {
  readonly code = 'ROUTE_STEP_NOT_IN_PROGRESS';
  constructor() {
    super('Current step is not IN_PROGRESS.', HttpStatus.CONFLICT);
  }
}

export class OverrideStepNotImplementedError extends DomainError {
  readonly code = 'ROUTE_OVERRIDE_NOT_IMPLEMENTED';
  constructor() {
    super('OVERRIDE step source is not yet implemented.', HttpStatus.NOT_IMPLEMENTED);
  }
}
