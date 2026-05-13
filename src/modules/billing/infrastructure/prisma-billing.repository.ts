import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { BillingAlreadyResolvedError } from '../domain/billing.errors';
import {
  BillingRepository,
  BillingSource,
  ClaimAndFetchResult,
} from '../domain/billing.repository';
import { BillingRequestView } from '../domain/billing.types';

type BillingRow = {
  id: string;
  orderId: string;
  type: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  resolvedAt: Date | null;
  notifiedAt?: Date | null;
  items: { id: string; orderItemId: string; amount: number }[];
};

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<BillingRequestView | null> {
    const row = await this.prisma.billingRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? this.toView(row) : null;
  }

  async findOrderCustomerId(orderId: string): Promise<string | null> {
    const order = await this.prisma.laundryOrder.findUnique({
      where: { id: orderId },
      select: { customer: { select: { customerId: true } } },
    });
    return order?.customer.customerId ?? null;
  }

  async countWaitingByOrder(orderId: string): Promise<number> {
    return this.prisma.billingRequest.count({
      where: { orderId, status: 'WAITING' },
    });
  }

  async findBySource(source: BillingSource): Promise<BillingRequestView | null> {
    const row = await this.prisma.billingRequest.findUnique({
      where: { sourceType_sourceId: { sourceType: source.type, sourceId: source.id } },
      include: { items: true },
    });
    return row ? this.toView(row) : null;
  }

  async findPendingByCustomerId(customerId: string): Promise<BillingRequestView[]> {
    const rows = await this.prisma.billingRequest.findMany({
      where: {
        order: { customer: { customerId } },
        status: 'WAITING',
        notifiedAt: { not: null },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * Idempotent: tag-item double-fire can call this twice for the same
   * orderItemId. `BillingRequestItem.orderItemId` is unique, so the second
   * INSERT raises P2002; we catch it and return the existing row.
   */
  async createBillingRequest(
    input: {
      orderId: string;
      items: { orderItemId: string; amount: number }[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<BillingRequestView> {
    const totalAmount = input.items.reduce((sum, i) => sum + i.amount, 0);
    const client = tx ?? this.prisma;

    try {
      const row = await client.billingRequest.create({
        data: {
          orderId: input.orderId,
          type: 'BASE',
          totalAmount,
          items: {
            create: input.items.map((i) => ({
              orderItemId: i.orderItemId,
              amount: i.amount,
            })),
          },
          events: {
            create: { eventType: 'BILLING_CREATED' },
          },
        },
        include: { items: true },
      });
      return this.toView(row);
    } catch (e) {
      if (this.isUniqueConstraintError(e)) {
        const existing = await client.billingRequestItem.findUnique({
          where: { orderItemId: input.items[0].orderItemId },
          include: { billingRequest: { include: { items: true } } },
        });
        if (existing) return this.toView(existing.billingRequest);
      }
      throw e;
    }
  }

  /**
   * Idempotent via UNIQUE(sourceType, sourceId). Concurrent callers for the
   * same source: first wins; second catches P2002 and returns the existing
   * row. `notifiedAt` is always null on creation — push happens at the next
   * `claimAndFetchWaiting` trigger.
   */
  async createSupplementBillingRequest(input: {
    orderId: string;
    totalAmount: number;
    source: BillingSource;
  }): Promise<BillingRequestView> {
    try {
      const row = await this.prisma.billingRequest.create({
        data: {
          orderId: input.orderId,
          type: 'SUPPLEMENT',
          totalAmount: input.totalAmount,
          sourceType: input.source.type,
          sourceId: input.source.id,
          // notifiedAt deliberately left null — see method docstring.
          events: {
            create: { eventType: 'BILLING_CREATED' },
          },
        },
        include: { items: true },
      });
      return this.toView(row);
    } catch (e) {
      if (this.isUniqueConstraintError(e)) {
        const existing = await this.findBySource(input.source);
        if (existing) return existing;
      }
      throw e;
    }
  }

  /**
   * CAS: only WAITING rows can transition. Concurrent pay/pay or pay/cancel
   * — first UPDATE matches WAITING; second sees 0 affected rows → throws.
   */
  async resolveRequest(
    id: string,
    status: 'PAID' | 'CANCELLED',
    actorId: string,
  ): Promise<BillingRequestView> {
    const eventType = status === 'PAID' ? 'PAYMENT_SUCCEED' : 'PAYMENT_FAILED';

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.billingRequest.updateMany({
        where: { id, status: 'WAITING' },
        data: { status, resolvedAt: new Date() },
      });
      if (result.count === 0) throw new BillingAlreadyResolvedError(id);

      await tx.paymentEvent.create({
        data: { billingRequestId: id, eventType, actorId },
      });

      const row = await tx.billingRequest.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      return this.toView(row);
    });
  }

  /**
   * Deadlock-free atomic claim + fetch:
   *
   *   1. CTE `claimed` is a single UPDATE that marks every WAITING row of
   *      the order whose `notified_at IS NULL` as notified NOW. Locks all
   *      touched rows in a single PG scan order; concurrent claims for
   *      sibling items in the same order either claim non-overlapping
   *      partitions or one waits for the other's COMMIT then re-evaluates
   *      WHERE and matches zero rows. No deadlock.
   *   2. Second SELECT fetches the FULL WAITING set (newly + previously
   *      claimed). Required because the user-web client REPLACES messages
   *      by orderId — each push must carry the complete picture or rows
   *      get dropped from the UI.
   *   3. Returns `justClaimedCount` so the caller can suppress redundant
   *      pushes when nothing new was claimed (the trigger is "any item
   *      reached READY_TO_PACKAGE" but subsequent triggers without new
   *      supplements shouldn't re-emit).
   *
   * BASE `totalAmount` is intentionally NOT updated here. BASE is frozen at
   * tag-item time. Route-change / approval cost flows into SUPPLEMENT rows,
   * which user-web sums client-side.
   */
  async claimAndFetchWaiting(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimAndFetchResult> {
    const work = async (client: Prisma.TransactionClient) => {
      const order = await client.laundryOrder.findUnique({
        where: { id: orderId },
        select: { customer: { select: { customerId: true } } },
      });
      if (!order) return { customerId: null, allWaiting: [], justClaimedCount: 0 };

      // CTE locks + claims unnotified rows atomically. updateMany returns
      // affected count but not the rows; we run findMany afterwards to get
      // the FULL waiting set (including ones already notified prior).
      const claimedResult = await client.billingRequest.updateMany({
        where: { orderId, status: 'WAITING', notifiedAt: null },
        data: { notifiedAt: new Date() },
      });

      const allWaitingRows = await client.billingRequest.findMany({
        where: { orderId, status: 'WAITING' },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      });

      return {
        customerId: order.customer.customerId,
        allWaiting: allWaitingRows.map((r) => this.toView(r)),
        justClaimedCount: claimedResult.count,
      };
    };

    return tx ? work(tx) : this.prisma.$transaction(work);
  }

  private isUniqueConstraintError(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
    );
  }

  private toView(row: BillingRow): BillingRequestView {
    return {
      id: row.id,
      orderId: row.orderId,
      type: row.type,
      status: row.status,
      totalAmount: row.totalAmount,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      notifiedAt: row.notifiedAt ?? null,
      items: row.items.map((i) => ({
        id: i.id,
        orderItemId: i.orderItemId,
        amount: i.amount,
      })),
    };
  }
}
