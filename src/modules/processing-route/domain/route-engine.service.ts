import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogger } from './audit-logger';
import { findNextTemplateStep, pickNextStep } from './next-step';
import {
  InvalidRouteCodeError,
  NoActivePlanError,
  PlanAlreadyExistsError,
  StepNotInProgressError,
} from './route-engine.errors';
import { ActorContext, CurrentStateView, StepView } from './processing-route.types';

type RouteRow = {
  id: string;
  code: string;
  steps: StepRow[];
};

type StepRow = {
  id: string;
  stepType: string;
  displayName: string;
  sortOrder: number;
};

type OverrideStepRow = StepRow & {
  flowCode: string;
  currentOffset: number;
  baseStepSortOrder: number;
};

type LoadedState = {
  orderItemId: string;
  planId: string;
  plan: { id: string; routeId: string; route: { id: string; code: string } };
  currentStepSource: 'ROUTE' | 'OVERRIDE';
  currentRouteStep: StepRow | null;
  currentOverrideId: string | null;
  currentOverrideStep: OverrideStepRow | null;
  currentStepStatus: 'IN_PROGRESS' | 'COMPLETED';
};

type NextStepResult = {
  step: StepRow;
  source: 'ROUTE' | 'OVERRIDE';
};

@Injectable()
export class RouteEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async createPlan(
    input: {
      orderItemId: string;
      routeCode: string;
      actor: ActorContext;
      reason?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<CurrentStateView> {
    const work = async (tx: Prisma.TransactionClient) => {
      const route = await this.loadRoute(tx, input.routeCode);

      const existing = await tx.itemProcessingPlan.findFirst({
        where: { orderItemId: input.orderItemId, status: 'ACTIVE' },
      });
      if (existing) throw new PlanAlreadyExistsError(input.orderItemId);

      const view = await this.initPlan(tx, {
        orderItemId: input.orderItemId,
        route,
        actor: input.actor,
        reason: input.reason,
      });

      await this.auditLogger.logInTransaction(tx, {
        actor: input.actor,
        actionType: 'PLAN_CREATED',
        targetType: 'ORDER_ITEM',
        targetId: input.orderItemId,
        afterState: { routeCode: route.code, planId: view.planId },
        reason: input.reason,
      });

      return view;
    };

    return externalTx ? work(externalTx) : this.prisma.$transaction(work);
  }

  async getCurrentState(orderItemId: string): Promise<CurrentStateView> {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.loadState(tx, orderItemId);
      const currentSortOrder = this.currentSortOrder(state);
      const nextResult = await this.findNextStep(tx, orderItemId, currentSortOrder, state.plan.routeId);
      return this.buildView(state, nextResult?.step ?? null);
    });
  }

  async startCurrentStep(input: {
    orderItemId: string;
    actor: ActorContext;
  }): Promise<CurrentStateView> {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.loadState(tx, input.orderItemId);
      if (state.currentStepStatus === 'COMPLETED') {
        throw new StepNotInProgressError();
      }

      const currentSortOrder = this.currentSortOrder(state);
      const nextResult = await this.findNextStep(tx, input.orderItemId, currentSortOrder, state.plan.routeId);
      return this.buildView(state, nextResult?.step ?? null);
    });
  }

  async completeCurrentStep(
    input: {
      orderItemId: string;
      actor: ActorContext;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<CurrentStateView> {
    const work = async (tx: Prisma.TransactionClient) => {
      const state = await this.loadState(tx, input.orderItemId);
      if (state.currentStepStatus !== 'IN_PROGRESS') {
        throw new StepNotInProgressError();
      }

      if (state.currentStepSource === 'OVERRIDE') {
        return this.completeOverrideStep(tx, state, input.actor);
      }
      return this.completeRouteStep(tx, state, input.actor);
    };

    return externalTx ? work(externalTx) : this.prisma.$transaction(work);
  }

  async switchRoute(input: {
    orderItemId: string;
    newRouteCode: string;
    actor: ActorContext;
    reason: string;
  }): Promise<CurrentStateView> {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.loadState(tx, input.orderItemId);
      const oldRouteCode = state.plan.route.code;

      await tx.itemProcessingPlan.update({
        where: { id: state.planId },
        data: { status: 'SUPERSEDED', supersededAt: new Date() },
      });
      await tx.itemProcessEvent.create({
        data: {
          orderItemId: input.orderItemId,
          planId: state.planId,
          eventType: 'PLAN_SUPERSEDED',
          actorType: input.actor.actorType,
          actorId: input.actor.actorId,
          staffRole: input.actor.staffRole,
          reason: input.reason,
        },
      });

      const newRoute = await this.loadRoute(tx, input.newRouteCode);

      const view = await this.initPlan(tx, {
        orderItemId: input.orderItemId,
        route: newRoute,
        actor: input.actor,
        reason: input.reason,
      });

      await this.auditLogger.logInTransaction(tx, {
        actor: input.actor,
        actionType: 'ROUTE_SWITCHED',
        targetType: 'ORDER_ITEM',
        targetId: input.orderItemId,
        beforeState: { routeCode: oldRouteCode },
        afterState: { routeCode: input.newRouteCode, newPlanId: view.planId },
        reason: input.reason,
      });

      return view;
    });
  }

  async activateOverrides(input: {
    orderItemId: string;
    flowCode: string;
    overrides: { stepType: string; sortOrder: number; displayName: string; offset: number }[];
    baseStepSortOrder: number;
    actor: ActorContext;
  }): Promise<CurrentStateView> {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.loadState(tx, input.orderItemId);

      const sorted = [...input.overrides].sort((a, b) => a.offset - b.offset);
      const first = sorted[0];

      const override = await tx.itemProcessingOverride.create({
        data: {
          orderItemId: input.orderItemId,
          flowCode: input.flowCode,
          currentOffset: first.offset,
          baseStepSortOrder: input.baseStepSortOrder,
          stepType: first.stepType,
          sortOrder: first.sortOrder,
          displayName: first.displayName,
          status: 'ACTIVE',
        },
      });

      await tx.itemProcessingState.update({
        where: { orderItemId: input.orderItemId },
        data: {
          currentStepSource: 'OVERRIDE',
          currentRouteStepId: null,
          currentOverrideId: override.id,
          currentStepStatus: 'IN_PROGRESS',
        },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: input.orderItemId,
          planId: state.planId,
          eventType: 'STEP_STARTED',
          overrideId: override.id,
          actorType: input.actor.actorType,
          actorId: input.actor.actorId,
          staffRole: input.actor.staffRole,
        },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor: input.actor,
        actionType: 'OVERRIDE_ACTIVATED',
        targetType: 'ORDER_ITEM',
        targetId: input.orderItemId,
        afterState: {
          flowCode: input.flowCode,
          baseStepSortOrder: input.baseStepSortOrder,
          firstStepType: first.stepType,
        },
      });

      const overrideStep: OverrideStepRow = {
        id: override.id,
        stepType: override.stepType,
        displayName: override.displayName,
        sortOrder: override.sortOrder,
        flowCode: override.flowCode,
        currentOffset: override.currentOffset,
        baseStepSortOrder: override.baseStepSortOrder,
      };

      const nextResult = await this.findNextStep(tx, input.orderItemId, override.sortOrder, state.plan.routeId);

      const newState: LoadedState = {
        ...state,
        currentStepSource: 'OVERRIDE',
        currentRouteStep: null,
        currentOverrideId: override.id,
        currentOverrideStep: overrideStep,
        currentStepStatus: 'IN_PROGRESS',
      };

      return this.buildView(newState, nextResult?.step ?? null);
    });
  }

  async skipRemainingOverrides(input: {
    orderItemId: string;
    actor: ActorContext;
  }): Promise<CurrentStateView> {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.loadState(tx, input.orderItemId);

      const resumeFromSortOrder = state.currentOverrideStep?.sortOrder ?? 0;

      await tx.itemProcessingOverride.updateMany({
        where: { orderItemId: input.orderItemId, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });

      const nextRouteStep = await tx.processingRouteStep.findFirst({
        where: {
          routeId: state.plan.routeId,
          sortOrder: { gt: resumeFromSortOrder },
        },
        orderBy: { sortOrder: 'asc' },
      });

      if (nextRouteStep) {
        await tx.itemProcessingState.update({
          where: { orderItemId: input.orderItemId },
          data: {
            currentStepSource: 'ROUTE',
            currentRouteStepId: nextRouteStep.id,
            currentOverrideId: null,
            currentStepStatus: 'IN_PROGRESS',
          },
        });

        await tx.itemProcessEvent.create({
          data: {
            orderItemId: input.orderItemId,
            planId: state.planId,
            eventType: 'STEP_STARTED',
            routeStepId: nextRouteStep.id,
            actorType: input.actor.actorType,
            actorId: input.actor.actorId,
            staffRole: input.actor.staffRole,
          },
        });

        await this.auditLogger.logInTransaction(tx, {
          actor: input.actor,
          actionType: 'OVERRIDES_SKIPPED',
          targetType: 'ORDER_ITEM',
          targetId: input.orderItemId,
          afterState: { resumedStepType: nextRouteStep.stepType },
        });

        const nextNextStep = await tx.processingRouteStep.findFirst({
          where: {
            routeId: state.plan.routeId,
            sortOrder: { gt: nextRouteStep.sortOrder },
          },
          orderBy: { sortOrder: 'asc' },
        });

        const newState: LoadedState = {
          ...state,
          currentStepSource: 'ROUTE',
          currentRouteStep: this.toStepRow(nextRouteStep),
          currentOverrideId: null,
          currentOverrideStep: null,
          currentStepStatus: 'IN_PROGRESS',
        };

        return this.buildView(newState, nextNextStep ? this.toStepRow(nextNextStep) : null);
      } else {
        await tx.itemProcessingState.update({
          where: { orderItemId: input.orderItemId },
          data: { currentStepStatus: 'COMPLETED', currentOverrideId: null },
        });

        await tx.itemProcessEvent.create({
          data: {
            orderItemId: input.orderItemId,
            planId: state.planId,
            eventType: 'PLAN_COMPLETED',
            actorType: input.actor.actorType,
            actorId: input.actor.actorId,
            staffRole: input.actor.staffRole,
          },
        });

        await this.auditLogger.logInTransaction(tx, {
          actor: input.actor,
          actionType: 'PLAN_COMPLETED',
          targetType: 'ORDER_ITEM',
          targetId: input.orderItemId,
          afterState: { routeCode: state.plan.route.code },
        });

        return this.buildView({ ...state, currentStepStatus: 'COMPLETED' }, null);
      }
    });
  }

  private async completeOverrideStep(
    tx: Prisma.TransactionClient,
    state: LoadedState,
    actor: ActorContext,
  ): Promise<CurrentStateView> {
    const currentOverride = state.currentOverrideStep!;
    const overrideRowId = currentOverride.id;

    await tx.itemProcessEvent.create({
      data: {
        orderItemId: state.orderItemId,
        planId: state.planId,
        eventType: 'STEP_COMPLETED',
        overrideId: overrideRowId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        staffRole: actor.staffRole,
      },
    });

    // Advance within current override or pop the stack
    const template = await tx.exceptionFlowTemplate.findFirst({
      where: { code: currentOverride.flowCode, active: true },
      include: { steps: { orderBy: { offset: 'asc' } } },
    });

    const nextTemplateStep = template?.steps.find((s) => s.offset > currentOverride.currentOffset) ?? null;

    if (nextTemplateStep) {
      // Advance to next step within the same override
      const newSortOrder = currentOverride.baseStepSortOrder + nextTemplateStep.offset;

      await tx.itemProcessingOverride.update({
        where: { id: overrideRowId },
        data: {
          currentOffset: nextTemplateStep.offset,
          stepType: nextTemplateStep.stepType,
          displayName: nextTemplateStep.displayName,
          sortOrder: newSortOrder,
        },
      });

      const nextResult = await this.findNextStep(tx, state.orderItemId, newSortOrder, state.plan.routeId);

      await tx.itemProcessingState.update({
        where: { orderItemId: state.orderItemId },
        data: { currentStepStatus: 'IN_PROGRESS' },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: state.orderItemId,
          planId: state.planId,
          eventType: 'STEP_STARTED',
          overrideId: overrideRowId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          staffRole: actor.staffRole,
        },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor,
        actionType: 'STEP_COMPLETED',
        targetType: 'ORDER_ITEM',
        targetId: state.orderItemId,
        afterState: { completedStepType: currentOverride.stepType, nextStepType: nextTemplateStep.stepType },
      });

      const newOverrideStep: OverrideStepRow = {
        id: overrideRowId,
        stepType: nextTemplateStep.stepType,
        displayName: nextTemplateStep.displayName,
        sortOrder: currentOverride.baseStepSortOrder + nextTemplateStep.offset,
        flowCode: currentOverride.flowCode,
        currentOffset: nextTemplateStep.offset,
        baseStepSortOrder: currentOverride.baseStepSortOrder,
      };

      const newState: LoadedState = {
        ...state,
        currentOverrideStep: newOverrideStep,
        currentStepStatus: 'IN_PROGRESS',
      };

      return this.buildView(newState, nextResult?.step ?? null);
    }

    // Last step of current override — mark COMPLETED and pop stack
    await tx.itemProcessingOverride.update({
      where: { id: overrideRowId },
      data: { status: 'COMPLETED' },
    });

    await this.auditLogger.logInTransaction(tx, {
      actor,
      actionType: 'STEP_COMPLETED',
      targetType: 'ORDER_ITEM',
      targetId: state.orderItemId,
      afterState: { completedStepType: currentOverride.stepType, flowCode: currentOverride.flowCode },
    });

    // Find previous ACTIVE override (stack top after pop)
    const prevOverride = await tx.itemProcessingOverride.findFirst({
      where: { orderItemId: state.orderItemId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (prevOverride) {
      await tx.itemProcessingState.update({
        where: { orderItemId: state.orderItemId },
        data: {
          currentOverrideId: prevOverride.id,
          currentStepSource: 'OVERRIDE',
          currentStepStatus: 'IN_PROGRESS',
        },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: state.orderItemId,
          planId: state.planId,
          eventType: 'STEP_STARTED',
          overrideId: prevOverride.id,
          actorType: actor.actorType,
          actorId: actor.actorId,
          staffRole: actor.staffRole,
        },
      });

      const prevOverrideStep: OverrideStepRow = {
        id: prevOverride.id,
        stepType: prevOverride.stepType,
        displayName: prevOverride.displayName,
        sortOrder: prevOverride.sortOrder,
        flowCode: prevOverride.flowCode,
        currentOffset: prevOverride.currentOffset,
        baseStepSortOrder: prevOverride.baseStepSortOrder,
      };

      const nextResult = await this.findNextStep(tx, state.orderItemId, prevOverride.sortOrder, state.plan.routeId);

      const newState: LoadedState = {
        ...state,
        currentStepSource: 'OVERRIDE',
        currentRouteStep: null,
        currentOverrideId: prevOverride.id,
        currentOverrideStep: prevOverrideStep,
        currentStepStatus: 'IN_PROGRESS',
      };

      return this.buildView(newState, nextResult?.step ?? null);
    }

    // Stack empty — resume route
    const nextRouteStep = await tx.processingRouteStep.findFirst({
      where: { routeId: state.plan.routeId, sortOrder: { gt: currentOverride.sortOrder } },
      orderBy: { sortOrder: 'asc' },
    });

    if (nextRouteStep) {
      await tx.itemProcessingState.update({
        where: { orderItemId: state.orderItemId },
        data: {
          currentStepSource: 'ROUTE',
          currentRouteStepId: nextRouteStep.id,
          currentOverrideId: null,
          currentStepStatus: 'IN_PROGRESS',
        },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: state.orderItemId,
          planId: state.planId,
          eventType: 'STEP_STARTED',
          routeStepId: nextRouteStep.id,
          actorType: actor.actorType,
          actorId: actor.actorId,
          staffRole: actor.staffRole,
        },
      });

      const nextNextResult = await this.findNextStep(tx, state.orderItemId, nextRouteStep.sortOrder, state.plan.routeId);

      const newState: LoadedState = {
        ...state,
        currentStepSource: 'ROUTE',
        currentRouteStep: this.toStepRow(nextRouteStep),
        currentOverrideId: null,
        currentOverrideStep: null,
        currentStepStatus: 'IN_PROGRESS',
      };

      return this.buildView(newState, nextNextResult?.step ?? null);
    }

    await tx.itemProcessingState.update({
      where: { orderItemId: state.orderItemId },
      data: { currentStepStatus: 'COMPLETED', currentOverrideId: null },
    });

    await tx.itemProcessEvent.create({
      data: {
        orderItemId: state.orderItemId,
        planId: state.planId,
        eventType: 'PLAN_COMPLETED',
        overrideId: overrideRowId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        staffRole: actor.staffRole,
      },
    });

    await this.auditLogger.logInTransaction(tx, {
      actor,
      actionType: 'PLAN_COMPLETED',
      targetType: 'ORDER_ITEM',
      targetId: state.orderItemId,
      afterState: { routeCode: state.plan.route.code },
    });

    return this.buildView({ ...state, currentOverrideId: null, currentOverrideStep: null, currentStepStatus: 'COMPLETED' }, null);
  }

  private async completeRouteStep(
    tx: Prisma.TransactionClient,
    state: LoadedState,
    actor: ActorContext,
  ): Promise<CurrentStateView> {
    const currentStep = state.currentRouteStep!;

    await tx.itemProcessEvent.create({
      data: {
        orderItemId: state.orderItemId,
        planId: state.planId,
        eventType: 'STEP_COMPLETED',
        routeStepId: currentStep.id,
        actorType: actor.actorType,
        actorId: actor.actorId,
        staffRole: actor.staffRole,
      },
    });

    const nextResult = await this.findNextStep(tx, state.orderItemId, currentStep.sortOrder, state.plan.routeId);

    if (nextResult) {
      const isNextOverride = nextResult.source === 'OVERRIDE';

      await tx.itemProcessingState.update({
        where: { orderItemId: state.orderItemId },
        data: {
          currentStepSource: nextResult.source,
          currentRouteStepId: isNextOverride ? null : nextResult.step.id,
          currentOverrideId: isNextOverride ? nextResult.step.id : null,
          currentStepStatus: 'IN_PROGRESS',
        },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: state.orderItemId,
          planId: state.planId,
          eventType: 'STEP_STARTED',
          routeStepId: isNextOverride ? null : nextResult.step.id,
          overrideId: isNextOverride ? nextResult.step.id : null,
          actorType: actor.actorType,
          actorId: actor.actorId,
          staffRole: actor.staffRole,
        },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor,
        actionType: 'STEP_COMPLETED',
        targetType: 'ORDER_ITEM',
        targetId: state.orderItemId,
        afterState: {
          completedStepType: currentStep.stepType,
          nextStepType: nextResult.step.stepType,
          nextStepSource: nextResult.source,
        },
      });

      const nextNextResult = await this.findNextStep(
        tx,
        state.orderItemId,
        nextResult.step.sortOrder,
        state.plan.routeId,
      );

      const newState: LoadedState = {
        ...state,
        currentStepSource: nextResult.source,
        currentRouteStep: isNextOverride ? null : nextResult.step,
        currentOverrideId: isNextOverride ? nextResult.step.id : null,
        currentOverrideStep: null,
        currentStepStatus: 'IN_PROGRESS',
      };

      return this.buildView(newState, nextNextResult?.step ?? null);
    } else {
      await tx.itemProcessingState.update({
        where: { orderItemId: state.orderItemId },
        data: { currentStepStatus: 'COMPLETED' },
      });

      await tx.itemProcessEvent.create({
        data: {
          orderItemId: state.orderItemId,
          planId: state.planId,
          eventType: 'PLAN_COMPLETED',
          routeStepId: currentStep.id,
          actorType: actor.actorType,
          actorId: actor.actorId,
          staffRole: actor.staffRole,
        },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor,
        actionType: 'PLAN_COMPLETED',
        targetType: 'ORDER_ITEM',
        targetId: state.orderItemId,
        afterState: { routeCode: state.plan.route.code },
      });

      return this.buildView({ ...state, currentStepStatus: 'COMPLETED' }, null);
    }
  }

  private async findNextStep(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    currentSortOrder: number,
    planRouteId: string,
  ): Promise<NextStepResult | null> {
    const [overrideRow, nextRouteStep] = await Promise.all([
      tx.itemProcessingOverride.findFirst({
        where: { orderItemId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
      tx.processingRouteStep.findFirst({
        where: { routeId: planRouteId, sortOrder: { gt: currentSortOrder } },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    let nextOverrideStep: StepRow | null = null;
    if (overrideRow) {
      if (overrideRow.sortOrder > currentSortOrder) {
        // override row is still ahead — it is the next step
        nextOverrideStep = {
          id: overrideRow.id,
          stepType: overrideRow.stepType,
          displayName: overrideRow.displayName,
          sortOrder: overrideRow.sortOrder,
        };
      } else if (overrideRow.sortOrder === currentSortOrder) {
        // we are currently ON the override row; peek at the next template step
        const template = await tx.exceptionFlowTemplate.findFirst({
          where: { code: overrideRow.flowCode, active: true },
          include: { steps: { orderBy: { offset: 'asc' } } },
        });
        nextOverrideStep = findNextTemplateStep(
          template?.steps ?? [],
          overrideRow.currentOffset,
          overrideRow.baseStepSortOrder,
          overrideRow.id,
        );
        if (!nextOverrideStep) {
          // Last step of current override — pop to the previous override in the stack
          const stackPrev = await tx.itemProcessingOverride.findFirst({
            where: { orderItemId, status: 'ACTIVE', id: { not: overrideRow.id } },
            orderBy: { createdAt: 'desc' },
          });
          if (stackPrev) {
            nextOverrideStep = {
              id: stackPrev.id,
              stepType: stackPrev.stepType,
              displayName: stackPrev.displayName,
              sortOrder: stackPrev.sortOrder,
            };
          }
        }
      }
    }

    const routeCandidate = nextRouteStep
      ? {
          id: nextRouteStep.id,
          stepType: nextRouteStep.stepType,
          displayName: nextRouteStep.displayName,
          sortOrder: nextRouteStep.sortOrder,
        }
      : null;

    return pickNextStep(nextOverrideStep, routeCandidate);
  }

  private async loadRoute(tx: Prisma.TransactionClient, code: string): Promise<RouteRow> {
    const route = await tx.processingRoute.findFirst({
      where: { code, active: true },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!route || route.steps.length === 0) throw new InvalidRouteCodeError(code);
    return route;
  }

  private async loadState(
    tx: Prisma.TransactionClient,
    orderItemId: string,
  ): Promise<LoadedState> {
    // Row-level lock to serialize concurrent mutations on the same item
    // (e.g. operator double-taps the scan button). Postgres holds the lock
    // until the surrounding transaction commits, so callers in
    // completeCurrentStep / activateOverrides / skipRemainingOverrides /
    // switchRoute / startCurrentStep are all gated. If no state row exists
    // yet, the lock acquires nothing and the subsequent findUnique throws
    // NoActivePlanError as before.
    await tx.$executeRaw`
      SELECT id FROM item_processing_states
      WHERE order_item_id = ${orderItemId}
      FOR UPDATE
    `;

    const state = await tx.itemProcessingState.findUnique({
      where: { orderItemId },
      include: {
        plan: { include: { route: true } },
        currentRouteStep: true,
        currentOverride: true,
      },
    });
    if (!state) throw new NoActivePlanError(orderItemId);

    const currentOverrideStep: OverrideStepRow | null = state.currentOverride
      ? {
          id: state.currentOverride.id,
          stepType: state.currentOverride.stepType,
          displayName: state.currentOverride.displayName,
          sortOrder: state.currentOverride.sortOrder,
          flowCode: state.currentOverride.flowCode,
          currentOffset: state.currentOverride.currentOffset,
          baseStepSortOrder: state.currentOverride.baseStepSortOrder,
        }
      : null;

    return {
      orderItemId: state.orderItemId,
      planId: state.planId,
      plan: state.plan as LoadedState['plan'],
      currentStepSource: state.currentStepSource,
      currentRouteStep: state.currentRouteStep,
      currentOverrideId: state.currentOverrideId,
      currentOverrideStep,
      currentStepStatus: state.currentStepStatus,
    };
  }

  private async initPlan(
    tx: Prisma.TransactionClient,
    input: {
      orderItemId: string;
      route: RouteRow;
      actor: ActorContext;
      reason?: string;
    },
  ): Promise<CurrentStateView> {
    const firstStep = input.route.steps[0];

    const plan = await tx.itemProcessingPlan.create({
      data: {
        orderItemId: input.orderItemId,
        routeId: input.route.id,
        reason: input.reason,
      },
    });

    await tx.itemProcessingState.upsert({
      where: { orderItemId: input.orderItemId },
      create: {
        orderItemId: input.orderItemId,
        planId: plan.id,
        currentStepSource: 'ROUTE',
        currentRouteStepId: firstStep.id,
        currentStepStatus: 'IN_PROGRESS',
      },
      update: {
        planId: plan.id,
        currentStepSource: 'ROUTE',
        currentRouteStepId: firstStep.id,
        currentStepStatus: 'IN_PROGRESS',
      },
    });

    await tx.itemProcessEvent.create({
      data: {
        orderItemId: input.orderItemId,
        planId: plan.id,
        eventType: 'PLAN_CREATED',
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        staffRole: input.actor.staffRole,
        reason: input.reason,
      },
    });
    await tx.itemProcessEvent.create({
      data: {
        orderItemId: input.orderItemId,
        planId: plan.id,
        eventType: 'STEP_STARTED',
        routeStepId: firstStep.id,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        staffRole: input.actor.staffRole,
      },
    });

    const nextStep = input.route.steps.length > 1 ? input.route.steps[1] : null;

    return {
      orderItemId: input.orderItemId,
      planId: plan.id,
      routeCode: input.route.code,
      currentStepSource: 'ROUTE',
      currentStep: {
        stepId: firstStep.id,
        stepType: firstStep.stepType,
        displayName: firstStep.displayName,
        sortOrder: firstStep.sortOrder,
        status: 'IN_PROGRESS',
      },
      nextStep: nextStep ? this.toStepView(nextStep) : null,
      isPlanCompleted: false,
    };
  }

  private currentSortOrder(state: LoadedState): number {
    return state.currentStepSource === 'OVERRIDE'
      ? state.currentOverrideStep?.sortOrder ?? 0
      : state.currentRouteStep?.sortOrder ?? 0;
  }

  private buildView(
    state: LoadedState,
    nextStep: StepRow | null | undefined,
  ): CurrentStateView {
    const currentStep =
      state.currentStepSource === 'OVERRIDE' ? state.currentOverrideStep : state.currentRouteStep;

    return {
      orderItemId: state.orderItemId,
      planId: state.planId,
      routeCode: state.plan.route.code,
      currentStepSource: state.currentStepSource,
      currentStep: currentStep
        ? {
            ...this.toStepView(currentStep),
            status: state.currentStepStatus,
          }
        : null,
      nextStep: nextStep ? this.toStepView(nextStep) : null,
      isPlanCompleted: state.currentStepStatus === 'COMPLETED',
    };
  }

  private toStepRow(step: {
    id: string;
    stepType: string;
    displayName: string;
    sortOrder: number;
  }): StepRow {
    return {
      id: step.id,
      stepType: step.stepType,
      displayName: step.displayName,
      sortOrder: step.sortOrder,
    };
  }

  private toStepView(step: StepRow): StepView {
    return {
      stepId: step.id,
      stepType: step.stepType,
      displayName: step.displayName,
      sortOrder: step.sortOrder,
    };
  }
}
