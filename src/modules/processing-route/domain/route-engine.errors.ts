import {
  BadRequestException,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';

export class InvalidRouteCodeError extends BadRequestException {
  constructor(code: string) {
    super(`Processing route not found or inactive: ${code}`);
  }
}

export class NoActivePlanError extends BadRequestException {
  constructor(orderItemId: string) {
    super(`No processing state found for item: ${orderItemId}`);
  }
}

export class PlanAlreadyExistsError extends ConflictException {
  constructor(orderItemId: string) {
    super(`Item already has an active processing plan: ${orderItemId}`);
  }
}

export class StepNotInProgressError extends ConflictException {
  constructor() {
    super('Current step is not IN_PROGRESS.');
  }
}

export class OverrideStepNotImplementedError extends NotImplementedException {
  constructor() {
    super('OVERRIDE step source is not yet implemented.');
  }
}
