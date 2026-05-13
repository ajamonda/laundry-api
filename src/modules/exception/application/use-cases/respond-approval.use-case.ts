import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { BillingService } from '../../../billing/domain/billing.service';
import { ExceptionGateway } from '../../interfaces/ws/exception.gateway';
import {
  ApprovalRequestAlreadyResolvedError,
  ApprovalRequestForbiddenError,
  ApprovalRequestNotFoundError,
} from '../../domain/exception.errors';

const APPROVE_DECISIONS = new Set([
  'APPROVE_REPAIR',
  'APPROVE_VENDOR',
  'APPROVE_PREMIUM',
]);
const SKIP_DECISIONS = new Set(['CLEAN_WITHOUT_REPAIR', 'APPROVE_AS_IS']);

@Injectable()
export class RespondApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeEngine: RouteEngineService,
    private readonly billingService: BillingService,
    private readonly exceptionGateway: ExceptionGateway,
  ) {}

  async execute(input: {
    approvalRequestId: string;
    decision: string;
    extraAmount?: number;
    customerId: string;
  }): Promise<void> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: input.approvalRequestId },
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                customer: { select: { customerId: true } },
              },
            },
          },
        },
      },
    });
    if (!approval)
      throw new ApprovalRequestNotFoundError(input.approvalRequestId);
    if (approval.orderItem.order.customer.customerId !== input.customerId) {
      throw new ApprovalRequestForbiddenError();
    }
    // Fast-fail when the row is already not WAITING — saves work in the
    // common (non-racy) case. Real race protection is the CAS below.
    if (approval.status !== 'WAITING')
      throw new ApprovalRequestAlreadyResolvedError();

    // CAS: atomic WAITING → RESOLVED. updateMany returns affected count;
    // concurrent caller will see 0 and bail out before triggering any
    // side effects (createSupplementBilling / routeEngine / socket emit).
    const claimed = await this.prisma.approvalRequest.updateMany({
      where: { id: input.approvalRequestId, status: 'WAITING' },
      data: {
        decision: input.decision,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new ApprovalRequestAlreadyResolvedError();

    const actor = {
      actorType: 'CUSTOMER' as const,
      actorId: input.customerId,
      staffRole: null,
    };
    const orderItemId = approval.orderItemId;
    const orderId = approval.orderItem.order.id;
    const customerId = approval.orderItem.order.customer.customerId;

    if (APPROVE_DECISIONS.has(input.decision)) {
      const result = await this.routeEngine.completeCurrentStep({ orderItemId, actor });

      if (result.isPlanCompleted) {
        await this.prisma.orderItem.update({
          where: { id: orderItemId },
          data: { status: 'READY_FOR_DELIVERY' },
        });
      }

      if (input.extraAmount != null && input.extraAmount !== 0) {
        // SUPPLEMENT 생성. 알림은 즉시 발송하지 않음 — 이 item이 READY_TO_PACKAGE에
        // 도달할 때 BASE billing과 함께 일괄 발송됨.
        // 상태머신상 approval은 INSPECTING/PREMIUM_INSPECTING에서만 가능하므로
        // 반드시 이후 READY_TO_PACKAGE 트리거가 발생함.
        await this.billingService.createSupplementBillingForApproval({
          approvalRequestId: input.approvalRequestId,
          orderId,
          totalAmount: input.extraAmount,
        });
      }
    } else if (SKIP_DECISIONS.has(input.decision)) {
      const result = await this.routeEngine.skipRemainingOverrides({ orderItemId, actor });

      if (result.isPlanCompleted) {
        await this.prisma.orderItem.update({
          where: { id: orderItemId },
          data: { status: 'READY_FOR_DELIVERY' },
        });
      }

      await this.prisma.itemExceptionContext.updateMany({
        where: { orderItemId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    } else if (input.decision === 'RETURN_WITHOUT_PROCESSING') {
      const result = await this.routeEngine.skipRemainingOverrides({ orderItemId, actor });

      if (result.isPlanCompleted) {
        await this.prisma.orderItem.update({
          where: { id: orderItemId },
          data: { status: 'READY_FOR_DELIVERY' },
        });
      }

      await this.prisma.itemExceptionContext.updateMany({
        where: { orderItemId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    }

    const resolved = {
      approvalRequestId: input.approvalRequestId,
      decision: input.decision,
      orderItemId,
    };

    this.exceptionGateway.notifyCustomer(customerId, 'exception:approval-resolved', resolved);
    this.exceptionGateway.notifyWashStaff('exception:approval-resolved', resolved);
  }
}
