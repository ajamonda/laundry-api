import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogQuery,
  AuditLogRepository,
} from '../../domain/audit-log.repository';

@Injectable()
export class GetAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repo: AuditLogRepository,
  ) {}

  execute(query: AuditLogQuery) {
    const limit = Math.min(query.limit ?? 20, 100);
    return this.repo.findLogs({ ...query, limit });
  }
}
