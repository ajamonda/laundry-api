import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ExceptionGateway } from '../../interfaces/ws/exception.gateway';
import { RouteChangeRequestView } from './request-route-change.use-case';

@Injectable()
export class RejectRouteChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
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
          include: { order: { select: { customer: { select: { customerId: true } } } } },
        },
      },
    });

    if (!changeRequest) throw new NotFoundException('경로 변경 요청을 찾을 수 없습니다.');
    if (changeRequest.orderItem.order.customer.customerId !== input.customerId) {
      throw new ForbiddenException('본인의 요청이 아닙니다.');
    }
    if (changeRequest.status !== 'PENDING') {
      throw new ConflictException('이미 처리된 요청입니다.');
    }

    const updated = await this.prisma.routeChangeRequest.update({
      where: { id: changeRequest.id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    this.exceptionGateway.notifyWashStaff('exception:route-change-resolved', {
      routeChangeRequestId: updated.id,
      orderItemId: updated.orderItemId,
      status: 'REJECTED',
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
