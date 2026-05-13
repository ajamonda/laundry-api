import { Inject, Injectable } from '@nestjs/common';
import { OrderItemStatus } from '@prisma/client';
import { BillingService } from '../../../billing/domain/billing.service';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ItemAwaitingCustomerDecision, ItemHasPendingRouteChange, ItemNotScannable, TagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';
import { ScanStepResult } from '../../domain/wash.types';

@Injectable()
export class ScanStepUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly routeEngine: RouteEngineService,
    private readonly billingService: BillingService,
  ) {}

  async execute(input: {
    tagBarcode: string;
    actor: ActorContext;
  }): Promise<ScanStepResult> {
    const item = await this.repo.findItemByTagBarcode(input.tagBarcode);
    if (!item) throw new TagNotFoundError(input.tagBarcode);
    if (item.status !== 'SORTED' && item.status !== 'PROCESSING') {
      throw new ItemNotScannable(item.itemId);
    }
    if (item.processingState?.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION') {
      throw new ItemAwaitingCustomerDecision(item.itemId);
    }

    const pendingRouteChange = await this.repo.findPendingRouteChange(item.itemId);
    if (pendingRouteChange) throw new ItemHasPendingRouteChange(item.itemId);

    let processingState = await this.routeEngine.completeCurrentStep({
      orderItemId: item.itemId,
      actor: input.actor,
    });

    // READY_TO_PACKAGE 스텝은 별도 스캔 없이 자동 완료
    if (!processingState.isPlanCompleted && processingState.currentStep?.stepType === 'READY_TO_PACKAGE') {
      processingState = await this.routeEngine.completeCurrentStep({
        orderItemId: item.itemId,
        actor: input.actor,
      });
    }

    const nextStatus: OrderItemStatus = processingState.isPlanCompleted
      ? OrderItemStatus.READY_TO_PACKAGE
      : item.status === 'SORTED'
        ? OrderItemStatus.PROCESSING
        : (item.status as OrderItemStatus);

    const updatedItem = await this.repo.setItemStatus({
      itemId: item.itemId,
      status: nextStatus,
    });

    if (nextStatus === OrderItemStatus.READY_TO_PACKAGE) {
      await this.billingService.onItemReadyToPackage(item.orderId);
    }

    return { item: updatedItem, processingState };
  }
}
