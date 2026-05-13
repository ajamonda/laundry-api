import { StaffRole } from '../../auth/domain/auth.types';

export type AuditLogEntry = {
  id: string;
  actorType: 'CUSTOMER' | 'STAFF';
  actorId: string;
  staffRole: StaffRole | null;
  actionType: string;
  targetType: string;
  targetId: string;
  beforeState: unknown;
  afterState: unknown;
  reason: string | null;
  metadata: unknown;
  timestamp: Date;
};

export type AuditLogQuery = {
  targetType?: string;
  targetId?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
};

export type PaginatedAuditLogs = {
  items: AuditLogEntry[];
  nextCursor: string | null;
};

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditLogRepository {
  findLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs>;
}
