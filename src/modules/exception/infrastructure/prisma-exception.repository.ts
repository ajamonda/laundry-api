import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogger } from '../../processing-route/domain/audit-logger';
import { ActorContext } from '../../processing-route/domain/processing-route.types';
import { ExceptionRepository } from '../domain/exception.repository';
import { ApprovalRequestView, IssueView } from '../domain/exception.types';

@Injectable()
export class PrismaExceptionRepository implements ExceptionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async findItemStatus(itemId: string): Promise<{ status: string } | null> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      select: { status: true },
    });
    return item ? { status: item.status } : null;
  }

  async findPendingApprovalsByCustomerId(customerId: string): Promise<ApprovalRequestView[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        status: 'WAITING',
        orderItem: { order: { customer: { customerId } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      approvalRequestId: row.id,
      flowCode: row.requestType,
      itemId: row.orderItemId,
      options: row.options,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  async createIssue(input: {
    itemId: string;
    issueType: string;
    note: string | null;
    actor: ActorContext;
  }): Promise<IssueView> {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.itemIssue.create({
        data: {
          orderItemId: input.itemId,
          issueType: input.issueType,
          note: input.note,
          raisedBy: input.actor.actorId,
        },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor: input.actor,
        actionType: 'ISSUE_RAISED',
        targetType: 'ORDER_ITEM',
        targetId: input.itemId,
        afterState: { issueType: input.issueType, issueId: issue.id },
      });

      return {
        id: issue.id,
        orderItemId: issue.orderItemId,
        issueType: issue.issueType,
        note: issue.note,
        raisedBy: issue.raisedBy,
        createdAt: issue.createdAt,
      };
    });
  }
}
