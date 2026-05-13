import { Inject, Injectable } from '@nestjs/common';
import { OrderItemStatus } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { BillingService, ReadyToPackageEmitPayload } from '../../../billing/domain/billing.service';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ItemAwaitingCustomerDecision, ItemHasPendingRouteChange, ItemNotScannable, TagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';
import { ScanStepResult } from '../../domain/wash.types';

/**
 * Atomically: advance route step(s) → flip item status → claim WAITING
 * billings (if reaching READY_TO_PACKAGE). All DB work happens in ONE
 * transaction. The customer WebSocket push, if any, is fired AFTER the
 * transaction commits so a rolled-back tx cannot leak a notification.
 */
@Injectable()
export class ScanStepUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly routeEngine: RouteEngineService,
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
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

    const { result, emitPayload } = await this.prisma.$transaction(async (tx) => {
      let processingState = await this.routeEngine.completeCurrentStep(
        { orderItemId: item.itemId, actor: input.actor },
        tx,
      );

      // READY_TO_PACKAGE 스텝은 별도 스캔 없이 자동 완료
      if (!processingState.isPlanCompleted && processingState.currentStep?.stepType === 'READY_TO_PACKAGE') {
        processingState = await this.routeEngine.completeCurrentStep(
          { orderItemId: item.itemId, actor: input.actor },
          tx,
        );
      }

      const nextStatus: OrderItemStatus = processingState.isPlanCompleted
        ? OrderItemStatus.READY_TO_PACKAGE
        : item.status === 'SORTED'
          ? OrderItemStatus.PROCESSING
          : (item.status as OrderItemStatus);

      const updatedItem = await this.repo.setItemStatus(
        { itemId: item.itemId, status: nextStatus },
        tx,
      );

      let emitPayload: ReadyToPackageEmitPayload = null;
      if (nextStatus === OrderItemStatus.READY_TO_PACKAGE) {
        emitPayload = await this.billingService.claimWaitingForReadyToPackage(
          item.orderId,
          tx,
        );
      }

      return {
        result: { item: updatedItem, processingState },
        emitPayload,
      };
    });

    // 트랜잭션 커밋 이후에만 WebSocket emit. 롤백 시 알림 누설 방지.
    this.billingService.emitReadyToPackage(emitPayload);

    return result;
  }
}
