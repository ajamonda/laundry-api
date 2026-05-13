import { StaffRole } from '../../auth/domain/auth.types';

export type ActorContext = {
  actorType: 'CUSTOMER' | 'STAFF';
  actorId: string;
  staffRole: StaffRole | null;
};

export type StepView = {
  stepId: string;
  stepType: string;
  displayName: string;
  sortOrder: number;
};

export type CurrentStateView = {
  orderItemId: string;
  planId: string;
  routeCode: string;
  currentStepSource: 'ROUTE' | 'OVERRIDE';
  currentStep: (StepView & { status: 'IN_PROGRESS' | 'COMPLETED' }) | null;
  nextStep: StepView | null;
  isPlanCompleted: boolean;
};

export type RouteView = {
  id: string;
  code: string;
  displayName: string;
  active: boolean;
};

export type RouteStepView = {
  id: string;
  stepType: string;
  displayName: string;
  sortOrder: number;
};

export type RouteWithStepsView = RouteView & {
  steps: RouteStepView[];
};

export type ProcessEventView = {
  id: string;
  orderItemId: string;
  planId: string | null;
  eventType: string;
  routeStepId: string | null;
  actorType: 'CUSTOMER' | 'STAFF';
  actorId: string;
  staffRole: StaffRole | null;
  reason: string | null;
  metadata: unknown;
  createdAt: Date;
};
