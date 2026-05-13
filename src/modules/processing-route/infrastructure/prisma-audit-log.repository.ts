import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogRepository,
  PaginatedAuditLogs,
} from '../domain/audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    const limit = query.limit ?? 20;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.cursor && { timestamp: { lt: new Date(query.cursor) } }),
    };

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    return {
      items: items.map(this.toEntry),
      nextCursor: hasNext ? items[items.length - 1].timestamp.toISOString() : null,
    };
  }

  private toEntry(log: {
    id: string;
    actorType: 'CUSTOMER' | 'STAFF';
    actorId: string;
    staffRole: 'PICKUP' | 'WASH' | 'DELIVERY' | 'ADMIN' | null;
    actionType: string;
    targetType: string;
    targetId: string;
    beforeState: unknown;
    afterState: unknown;
    reason: string | null;
    metadata: unknown;
    timestamp: Date;
  }): AuditLogEntry {
    return {
      id: log.id,
      actorType: log.actorType,
      actorId: log.actorId,
      staffRole: log.staffRole,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      beforeState: log.beforeState,
      afterState: log.afterState,
      reason: log.reason,
      metadata: log.metadata,
      timestamp: log.timestamp,
    };
  }
}
