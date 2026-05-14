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

// Routes that include repair work (in-house or outsourced). When switching to
// a route NOT in this set, existing `repair` OrderItemOption rows are dropped
// so they no longer appear in the item-detail UI.
const ROUTES_WITH_REPAIR = new Set<string>([
  'REPAIR_AND_CLEANING',
  'REPAIR_AND_PREMIUM_CLEANING',
  'REPAIR_AND_SHOES_CLEANING',
  'REPAIR_AND_PREMIUM_SHOES_CLEANING',
  'OUTSOURCED_CLEANING',
  'OUTSOURCED_PREMIUM_SHOES_CLEANING',
]);

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

    // 새 경로에 수선이 없으면 기존 repair 옵션 행을 모두 제거.
    // wash-web의 ItemDetailsSection은 selectedOptions를 그대로 렌더링하므로
    // 이 행이 남아있으면 bag scan / order search / step scan 모두에서
    // 잘못된 수선 옵션이 계속 노출됨.
    // 새 경로가 수선 포함이면 기존 repair 옵션을 그대로 보존 — 수선 옵션 자체를
    // 교체하는 흐름은 별도(현재 폼은 신규 repair 선택 데이터를 백엔드로 보내지 않음).
    if (!ROUTES_WITH_REPAIR.has(changeRequest.toRouteCode)) {
      await this.prisma.orderItemOption.deleteMany({
        where: {
          orderItemId: changeRequest.orderItemId,
          groupCodeSnapshot: 'repair',
        },
      });
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
