import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GetActiveRoutesUseCase } from './application/use-cases/get-active-routes.use-case';
import { GetAuditLogsUseCase } from './application/use-cases/get-audit-logs.use-case';
import { GetItemProcessEventsUseCase } from './application/use-cases/get-item-process-events.use-case';
import { GetItemProcessingUseCase } from './application/use-cases/get-item-processing.use-case';
import { GetRouteByCodeUseCase } from './application/use-cases/get-route-by-code.use-case';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log.repository';
import { AuditLogger } from './domain/audit-logger';
import { PROCESSING_ROUTE_REPOSITORY } from './domain/processing-route.repository';
import { RouteEngineService } from './domain/route-engine.service';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository';
import { PrismaProcessingRouteRepository } from './infrastructure/prisma-processing-route.repository';
import { AuditLogController } from './interfaces/http/audit-log.controller';
import { ItemProcessingController } from './interfaces/http/item-processing.controller';
import { ProcessingRouteController } from './interfaces/http/processing-route.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    ProcessingRouteController,
    ItemProcessingController,
    AuditLogController,
  ],
  providers: [
    RouteEngineService,
    AuditLogger,
    GetActiveRoutesUseCase,
    GetRouteByCodeUseCase,
    GetItemProcessingUseCase,
    GetItemProcessEventsUseCase,
    GetAuditLogsUseCase,
    {
      provide: PROCESSING_ROUTE_REPOSITORY,
      useClass: PrismaProcessingRouteRepository,
    },
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
  ],
  exports: [RouteEngineService, AuditLogger],
})
export class ProcessingRouteModule {}
