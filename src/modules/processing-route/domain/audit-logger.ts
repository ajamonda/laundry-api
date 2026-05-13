import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext } from './processing-route.types';

@Injectable()
export class AuditLogger {
  async logInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      actor: ActorContext;
      actionType: string;
      targetType: string;
      targetId: string;
      beforeState?: unknown;
      afterState?: unknown;
      reason?: string;
      metadata?: unknown;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: params.actor.actorType,
        actorId: params.actor.actorId,
        staffRole: params.actor.staffRole,
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId,
        beforeState:
          params.beforeState !== undefined
            ? (params.beforeState as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        afterState:
          params.afterState !== undefined
            ? (params.afterState as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        reason: params.reason,
        metadata:
          params.metadata !== undefined
            ? (params.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }
}
