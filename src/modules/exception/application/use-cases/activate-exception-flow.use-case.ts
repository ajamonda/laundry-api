import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ActorContext, CurrentStateView } from '../../../processing-route/domain/processing-route.types';
import { ExceptionGateway } from '../../interfaces/ws/exception.gateway';
import { ExceptionFlowActiveError, ExceptionItemNotFoundError, ItemNotIssuableError, PendingRouteChangeExistsError } from '../../domain/exception.errors';
import { FlowTemplateNotFoundError } from '../../domain/exception.errors';

@Injectable()
export class ActivateExceptionFlowUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeEngine: RouteEngineService,
    private readonly exceptionGateway: ExceptionGateway,
  ) {}

  async execute(input: {
    itemId: string;
    flowCode: string;
    additionalCost?: number;
    actor: ActorContext;
  }): Promise<CurrentStateView> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: input.itemId },
      include: { order: { select: { id: true, customer: { select: { customerId: true } } } } },
    });
    if (!item) throw new ExceptionItemNotFoundError(input.itemId);
    if (item.status !== 'PROCESSING' && item.status !== 'SORTED') {
      throw new ItemNotIssuableError(input.itemId);
    }

    const pendingRouteChange = await this.prisma.routeChangeRequest.findFirst({
      where: { orderItemId: input.itemId, status: 'PENDING' },
    });
    if (pendingRouteChange) throw new PendingRouteChangeExistsError(input.itemId);

    const template = await this.prisma.exceptionFlowTemplate.findFirst({
      where: { code: input.flowCode, active: true },
      include: { steps: { orderBy: { offset: 'asc' } } },
    });
    if (!template) throw new FlowTemplateNotFoundError(input.flowCode);

    const currentState = await this.routeEngine.getCurrentState(input.itemId);
    const baseStepSortOrder = currentState.currentStep?.sortOrder ?? 0;

    // Block only while waiting on the customer — the staff has nothing to do
    // there. Otherwise allow stacking exceptions even on top of an existing
    // override: routeEngine.activateOverrides creates a new ItemProcessingOverride
    // and the completeOverrideStep pop-logic walks back through the stack by
    // createdAt desc, so nested overrides resume each prior one in order.
    if (currentState.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION') {
      throw new ExceptionFlowActiveError(input.itemId);
    }

    const overrideInputs = template.steps.map((step) => ({
      stepType: step.stepType,
      sortOrder: baseStepSortOrder + step.offset,
      displayName: step.displayName,
      offset: step.offset,
    }));

    const updatedState = await this.routeEngine.activateOverrides({
      orderItemId: input.itemId,
      flowCode: input.flowCode,
      overrides: overrideInputs,
      baseStepSortOrder,
      actor: input.actor,
    });

    const plan = await this.prisma.itemProcessingPlan.findFirst({
      where: { orderItemId: input.itemId, status: 'ACTIVE' },
    });

    const maxOverrideSortOrder = Math.max(...overrideInputs.map((o) => o.sortOrder));
    const resumeStep = plan
      ? await this.prisma.processingRouteStep.findFirst({
          where: { routeId: plan.routeId, sortOrder: { gt: maxOverrideSortOrder } },
          orderBy: { sortOrder: 'asc' },
        })
      : null;

    await this.prisma.itemExceptionContext.upsert({
      where: { orderItemId: input.itemId },
      create: {
        orderItemId: input.itemId,
        interruptedSortOrder: baseStepSortOrder,
        resumeStepSortOrder: resumeStep?.sortOrder ?? null,
      },
      update: {
        interruptedSortOrder: baseStepSortOrder,
        resumeStepSortOrder: resumeStep?.sortOrder ?? null,
        resolvedAt: null,
      },
    });

    const needsApproval = template.steps.some((s) => s.stepType === 'WAIT_CUSTOMER_DECISION');
    if (needsApproval) {
      const approvalRequest = await this.prisma.approvalRequest.create({
        data: {
          orderItemId: input.itemId,
          requestType: input.flowCode,
          status: 'WAITING',
          options: template.steps.map((s) => ({
            stepType: s.stepType,
            displayName: s.displayName,
            offset: s.offset,
          })) as object,
        },
      });

      this.exceptionGateway.notifyCustomer(item.order.customer.customerId, 'exception:approval-requested', {
        approvalRequestId: approvalRequest.id,
        flowCode: input.flowCode,
        itemId: input.itemId,
        options: approvalRequest.options,
        additionalCost: input.additionalCost ?? null,
      });
    }

    return updatedState;
  }
}
