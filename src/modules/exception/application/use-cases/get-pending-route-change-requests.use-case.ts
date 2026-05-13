import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { RouteChangeRequestView } from './request-route-change.use-case';

@Injectable()
export class GetPendingRouteChangeRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(customerId: string): Promise<RouteChangeRequestView[]> {
    const requests = await this.prisma.routeChangeRequest.findMany({
      where: {
        status: 'PENDING',
        orderItem: { order: { customer: { customerId } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((r) => ({
      id: r.id,
      orderItemId: r.orderItemId,
      fromRouteCode: r.fromRouteCode,
      toRouteCode: r.toRouteCode,
      additionalCost: r.additionalCost,
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
