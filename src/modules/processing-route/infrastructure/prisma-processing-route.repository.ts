import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProcessingRouteRepository } from '../domain/processing-route.repository';
import {
  CurrentStateView,
  ProcessEventView,
  RouteView,
  RouteWithStepsView,
} from '../domain/processing-route.types';

@Injectable()
export class PrismaProcessingRouteRepository implements ProcessingRouteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRoutes(): Promise<RouteWithStepsView[]> {
    const routes = await this.prisma.processingRoute.findMany({
      where: { active: true },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { displayName: 'asc' },
    });
    return routes.map((r) => ({
      id: r.id,
      code: r.code,
      displayName: r.displayName,
      active: r.active,
      steps: r.steps.map((s) => ({
        id: s.id,
        stepType: s.stepType,
        displayName: s.displayName,
        sortOrder: s.sortOrder,
      })),
    }));
  }

  async findRouteByCode(code: string): Promise<RouteWithStepsView | null> {
    const route = await this.prisma.processingRoute.findFirst({
      where: { code },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!route) return null;
    return {
      id: route.id,
      code: route.code,
      displayName: route.displayName,
      active: route.active,
      steps: route.steps.map((s) => ({
        id: s.id,
        stepType: s.stepType,
        displayName: s.displayName,
        sortOrder: s.sortOrder,
      })),
    };
  }

  async findItemProcessing(orderItemId: string): Promise<CurrentStateView | null> {
    const state = await this.prisma.itemProcessingState.findUnique({
      where: { orderItemId },
      include: {
        plan: { include: { route: true } },
        currentRouteStep: true,
        currentOverride: true,
      },
    });
    if (!state) return null;

    const isOverride = state.currentStepSource === 'OVERRIDE';
    const currentOverride = state.currentOverride;
    const currentSortOrder = isOverride
      ? (currentOverride?.sortOrder ?? 0)
      : (state.currentRouteStep?.sortOrder ?? 0);

    let nextStep: { id: string; stepType: string; displayName: string; sortOrder: number } | null = null;
    if (isOverride && currentOverride) {
      const template = await this.prisma.exceptionFlowTemplate.findFirst({
        where: { code: currentOverride.flowCode, active: true },
        include: { steps: { orderBy: { offset: 'asc' } } },
      });
      const nextTemplateStep = template?.steps.find((s) => s.offset > currentOverride.currentOffset) ?? null;
      if (nextTemplateStep) {
        nextStep = {
          id: currentOverride.id,
          stepType: nextTemplateStep.stepType,
          displayName: nextTemplateStep.displayName,
          sortOrder: currentOverride.baseStepSortOrder + nextTemplateStep.offset,
        };
      }
    } else if (!isOverride && state.currentRouteStep) {
      nextStep = await this.prisma.processingRouteStep.findFirst({
        where: { routeId: state.plan.routeId, sortOrder: { gt: currentSortOrder } },
        orderBy: { sortOrder: 'asc' },
      });
    }

    const currentStep = isOverride && currentOverride
      ? {
          stepId: currentOverride.id,
          stepType: currentOverride.stepType,
          displayName: currentOverride.displayName,
          sortOrder: currentOverride.sortOrder,
          status: state.currentStepStatus,
        }
      : state.currentRouteStep
        ? {
            stepId: state.currentRouteStep.id,
            stepType: state.currentRouteStep.stepType,
            displayName: state.currentRouteStep.displayName,
            sortOrder: state.currentRouteStep.sortOrder,
            status: state.currentStepStatus,
          }
        : null;

    return {
      orderItemId: state.orderItemId,
      planId: state.planId,
      routeCode: state.plan.route.code,
      currentStepSource: state.currentStepSource,
      currentStep,
      nextStep: nextStep
        ? {
            stepId: nextStep.id,
            stepType: nextStep.stepType,
            displayName: nextStep.displayName,
            sortOrder: nextStep.sortOrder,
          }
        : null,
      isPlanCompleted: state.currentStepStatus === 'COMPLETED',
    };
  }

  async findItemProcessEvents(orderItemId: string): Promise<ProcessEventView[]> {
    const events = await this.prisma.itemProcessEvent.findMany({
      where: { orderItemId },
      orderBy: { createdAt: 'asc' },
    });
    return events.map((e) => ({
      id: e.id,
      orderItemId: e.orderItemId,
      planId: e.planId,
      eventType: e.eventType,
      routeStepId: e.routeStepId,
      actorType: e.actorType,
      actorId: e.actorId,
      staffRole: e.staffRole,
      reason: e.reason,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  }
}
