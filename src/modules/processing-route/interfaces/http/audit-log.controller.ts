import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { GetAuditLogsUseCase } from '../../application/use-cases/get-audit-logs.use-case';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@StaffRoles('ADMIN')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly getAuditLogs: GetAuditLogsUseCase) {}

  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.getAuditLogs.execute(query);
  }
}
