import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { BillingService } from '../../../billing/domain/billing.service';
import {
  RouteChangeRequestAlreadyResolvedError,
  RouteChangeRequestForbiddenError,
  RouteChangeRequestNotFoundError,
} from '../../domain/exception.errors';
import { ExceptionGateway } from '../../interfaces/ws/exception.gateway';
import { RouteChangeRequestView } from './request-route-change.use-case';

// Route code → implied cleaning_method option code
const ROUTE_CLEANING_METHOD: Record<string, string | null> = {
  GENERAL_CLOTHES_CLEANING:          'regular_wash',
  REPAIR_AND_CLEANING:               'regular_wash',
  PREMIUM_CLEANING:                  'premium_wash',
  REPAIR_AND_PREMIUM_CLEANING:       'premium_wash',
  STANDARD_SHOES_CLEANING:           'regular_wash',
  PREMIUM_SHOES_CLEANING:            'premium_wash',
  REPAIR_AND_SHOES_CLEANING:         'regular_wash',
  REPAIR_AND_PREMIUM_SHOES_CLEANING: 'premium_wash',
  OUTSOURCED_CLEANING:               'regular_wash',
  OUTSOURCED_PREMIUM_SHOES_CLEANING: 'premium_wash',
  QUICK_LAUNDRY:                     'water_wash_high_temperature_dry',
  OUTSOURCED_ONLY_CLEANING:          null,
};

@Injectable()
export class ApproveRouteChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeEngine: RouteEngineService,
    private readonly billingService: BillingService,
    private readonly exceptionGateway: ExceptionGateway,
  ) {}

  async execute(input: {
    routeChangeRequestId: string;
    customerId: string;
  }): Promise<RouteChangeRequestView> {
    const changeRequest = await this.prisma.routeChangeRequest.findUnique({
      where: { id: input.routeChangeRequestId },
      include: {
        orderItem: {
          include: {
            order: { select: { id: true, customer: { select: { customerId: true } } } },
          },
        },
      },
    });

    if (!changeRequest) throw new RouteChangeRequestNotFoundError(input.routeChangeRequestId);
    if (changeRequest.orderItem.order.customer.customerId !== input.customerId) {
      throw new RouteChangeRequestForbiddenError();
    }
    // Fast-fail (non-racy case).
    if (changeRequest.status !== 'PENDING') {
      throw new RouteChangeRequestAlreadyResolvedError();
    }

    // CAS: atomic PENDING → APPROVED. Concurrent approve double-fire sees
    // count === 0 and bails before triggering switchRoute / supplement /
    // estimatedMinAmount increment / cleaning_method option swap.
    const claimed = await this.prisma.routeChangeRequest.updateMany({
      where: { id: input.routeChangeRequestId, status: 'PENDING' },
      data: { status: 'APPROVED', respondedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new RouteChangeRequestAlreadyResolvedError();
    }

    await this.routeEngine.switchRoute({
      orderItemId: changeRequest.orderItemId,
      newRouteCode: changeRequest.toRouteCode,
      actor: { actorType: 'CUSTOMER', actorId: input.customerId, staffRole: null },
      reason: `고객 승인 — ${changeRequest.reason}`,
    });

    // cleaning_method 옵션을 새 경로에 맞게 업데이트
    const newCleaningMethodCode = ROUTE_CLEANING_METHOD[changeRequest.toRouteCode];
    if (newCleaningMethodCode) {
      const newCatalogOption = await this.prisma.catalogOption.findFirst({
        where: {
          code: newCleaningMethodCode,
          optionGroup: {
            code: 'cleaning_method',
            catalogItem: { code: changeRequest.orderItem.catalogItemCode },
          },
        },
      });

      if (newCatalogOption) {
        await this.prisma.orderItemOption.updateMany({
          where: {
            orderItemId: changeRequest.orderItemId,
            groupCodeSnapshot: 'cleaning_method',
          },
          data: {
            catalogOptionId: newCatalogOption.id,
            optionCodeSnapshot: newCatalogOption.code,
            displayNameSnapshot: newCatalogOption.displayName,
          },
        });
      }
    }

    // supplement billing 생성 — routeChangeRequestId를 idempotency key로 사용.
    // 알림은 즉시 발송하지 않음 — 이 item이 READY_TO_PACKAGE에 도달할 때 BASE
    // billing과 함께 일괄 발송됨. 상태머신상 route-change는 SORTED에서만 가능하므로
    // 반드시 이후 READY_TO_PACKAGE 트리거가 발생함.
    //
    // orderItem.estimatedMinAmount는 누적 갱신: wash-web의 RouteChangeForm이
    // 차후 route 변경 시 "(새 route 가격) - estimatedMinAmount"로 추가비용을
    // 산정하므로, 누적값이 필요함 (BASE billing.totalAmount는 tag 시점 freeze).
    if (changeRequest.additionalCost != null && changeRequest.additionalCost !== 0) {
      const orderId = changeRequest.orderItem.order.id;
      await this.billingService.createSupplementBillingForRouteChange({
        routeChangeRequestId: changeRequest.id,
        orderId,
        totalAmount: changeRequest.additionalCost,
      });

      await this.prisma.orderItem.update({
        where: { id: changeRequest.orderItemId },
        data: { estimatedMinAmount: { increment: changeRequest.additionalCost } },
      });
    }

    // CAS already moved status → APPROVED; fetch the latest row for the response.
    const updated = await this.prisma.routeChangeRequest.findUniqueOrThrow({
      where: { id: changeRequest.id },
    });

    this.exceptionGateway.notifyWashStaff('exception:route-change-resolved', {
      routeChangeRequestId: updated.id,
      orderItemId: updated.orderItemId,
      status: 'APPROVED',
    });

    return {
      id: updated.id,
      orderItemId: updated.orderItemId,
      fromRouteCode: updated.fromRouteCode,
      toRouteCode: updated.toRouteCode,
      additionalCost: updated.additionalCost,
      reason: updated.reason,
      status: updated.status,
      requestedBy: updated.requestedBy,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
