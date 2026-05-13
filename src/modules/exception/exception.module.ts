import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../../database/prisma.module';
import { ProcessingRouteModule } from '../processing-route/processing-route.module';
import { ActivateExceptionFlowUseCase } from './application/use-cases/activate-exception-flow.use-case';
import { ApproveRouteChangeUseCase } from './application/use-cases/approve-route-change.use-case';
import { GetCustomerApprovalRequestsUseCase } from './application/use-cases/get-customer-approval-requests.use-case';
import { GetPendingRouteChangeRequestsUseCase } from './application/use-cases/get-pending-route-change-requests.use-case';
import { RaiseIssueUseCase } from './application/use-cases/raise-issue.use-case';
import { RejectRouteChangeUseCase } from './application/use-cases/reject-route-change.use-case';
import { RequestRouteChangeUseCase } from './application/use-cases/request-route-change.use-case';
import { RespondApprovalUseCase } from './application/use-cases/respond-approval.use-case';
import { EXCEPTION_REPOSITORY } from './domain/exception.repository';
import { PrismaExceptionRepository } from './infrastructure/prisma-exception.repository';
import { ExceptionController } from './interfaces/http/exception.controller';
import { RouteChangeController } from './interfaces/http/route-change.controller';
import { ExceptionGateway } from './interfaces/ws/exception.gateway';

@Module({
  imports: [PrismaModule, AuthModule, ProcessingRouteModule, BillingModule],
  controllers: [ExceptionController, RouteChangeController],
  providers: [
    RaiseIssueUseCase,
    ActivateExceptionFlowUseCase,
    RespondApprovalUseCase,
    GetCustomerApprovalRequestsUseCase,
    RequestRouteChangeUseCase,
    ApproveRouteChangeUseCase,
    RejectRouteChangeUseCase,
    GetPendingRouteChangeRequestsUseCase,
    ExceptionGateway,
    { provide: EXCEPTION_REPOSITORY, useClass: PrismaExceptionRepository },
  ],
})
export class ExceptionModule {}
