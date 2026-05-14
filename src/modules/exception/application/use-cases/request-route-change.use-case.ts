import { Injectable } from '@nestjs/common';
import { mapUniqueConflict } from '../../../../common/errors/idempotency';
import { PrismaService } from '../../../../database/prisma.service';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { ExceptionGateway } from '../../interfaces/ws/exception.gateway';
import { ExceptionFlowActiveError, ExceptionItemNotFoundError, ItemNotIssuableError, PendingRouteChangeExistsError } from '../../domain/exception.errors';

export type RouteChangeRequestView = {
  id: string;
  orderItemId: string;
  fromRouteCode: string;
  toRouteCode: string;
  additionalCost: number | null;
  reason: string;
  status: string;
  requestedBy: string;
  createdAt: string;
};

@Injectable()
export class RequestRouteChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeEngine: RouteEngineService,
    private readonly exceptionGateway: ExceptionGateway,
  ) {}

  async execute(input: {
    itemId: string;
    toRouteCode: string;
    additionalCost?: number;
    reason: string;
    repairOptions?: { optionCode: string; inputValue?: string }[];
    actor: ActorContext;
  }): Promise<RouteChangeRequestView> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: input.itemId },
      include: { order: { select: { id: true, customer: { select: { customerId: true } } } } },
    });
    if (!item) throw new ExceptionItemNotFoundError(input.itemId);
    if (item.status !== 'PROCESSING' && item.status !== 'SORTED') {
      throw new ItemNotIssuableError(input.itemId);
    }

    // Fast-fail pre-check (saves a round-trip in the common case). The
    // create() below is the authoritative guard via the partial UNIQUE
    // index `(order_item_id) WHERE status = 'PENDING'` — see migration
    // 20260514120000_route_change_one_pending_per_item.
    const pendingRouteChange = await this.prisma.routeChangeRequest.findFirst({
      where: { orderItemId: input.itemId, status: 'PENDING' },
    });
    if (pendingRouteChange) throw new PendingRouteChangeExistsError(input.itemId);

    const processingState = await this.prisma.itemProcessingState.findUnique({
      where: { orderItemId: input.itemId },
    });
    if (processingState?.currentStepSource === 'OVERRIDE') {
      throw new ExceptionFlowActiveError(input.itemId);
    }

    const currentState = await this.routeEngine.getCurrentState(input.itemId);
    const fromRouteCode = currentState.routeCode;

    // Normalize repair-options snapshot. Empty array → null so callers can
    // tell "intentionally none" vs "the destination route has a repair group
    // and the staff made a non-empty selection". ApproveRouteChangeUseCase
    // only replays repair OrderItemOption rows when this is a non-empty array.
    const repairOptionsSnapshot =
      input.repairOptions && input.repairOptions.length > 0
        ? input.repairOptions.map((o) => ({
            optionCode: o.optionCode,
            inputValue: o.inputValue ?? null,
          }))
        : null;

    // mapUniqueConflict handles the concurrent-race path: if a sibling
    // request just inserted a PENDING row between the pre-check above and
    // this create(), Postgres rejects with P2002 and we surface
    // PendingRouteChangeExistsError — identical to the sequential branch.
    const changeRequest = await mapUniqueConflict(
      () =>
        this.prisma.routeChangeRequest.create({
          data: {
            orderItemId: input.itemId,
            fromRouteCode,
            toRouteCode: input.toRouteCode,
            additionalCost: input.additionalCost ?? null,
            reason: input.reason,
            status: 'PENDING',
            requestedBy: input.actor.actorId,
            repairOptionsSnapshot: repairOptionsSnapshot ?? undefined,
          },
        }),
      () => new PendingRouteChangeExistsError(input.itemId),
    );

    this.exceptionGateway.notifyCustomer(
      item.order.customer.customerId,
      'exception:route-change-requested',
      {
        routeChangeRequestId: changeRequest.id,
        itemId: input.itemId,
        fromRouteCode,
        toRouteCode: input.toRouteCode,
        additionalCost: changeRequest.additionalCost,
        reason: changeRequest.reason,
      },
    );

    return this.toView(changeRequest);
  }

  private toView(r: {
    id: string;
    orderItemId: string;
    fromRouteCode: string;
    toRouteCode: string;
    additionalCost: number | null;
    reason: string;
    status: string;
    requestedBy: string;
    createdAt: Date;
  }): RouteChangeRequestView {
    return {
      id: r.id,
      orderItemId: r.orderItemId,
      fromRouteCode: r.fromRouteCode,
      toRouteCode: r.toRouteCode,
      additionalCost: r.additionalCost,
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
