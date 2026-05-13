import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../database/prisma.module';
import { CancelBillingRequestUseCase } from './application/use-cases/cancel-billing-request.use-case';
import { GetBillingRequestUseCase } from './application/use-cases/get-billing-request.use-case';
import { GetCustomerBillingRequestsUseCase } from './application/use-cases/get-customer-billing-requests.use-case';
import { PayBillingRequestUseCase } from './application/use-cases/pay-billing-request.use-case';
import { BILLING_REPOSITORY } from './domain/billing.repository';
import { BillingService } from './domain/billing.service';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository';
import { BillingController } from './interfaces/http/billing.controller';
import { BillingGateway } from './interfaces/ws/billing.gateway';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BillingController],
  providers: [
    GetBillingRequestUseCase,
    GetCustomerBillingRequestsUseCase,
    PayBillingRequestUseCase,
    CancelBillingRequestUseCase,
    BillingService,
    BillingGateway,
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
  ],
  exports: [BillingService],
})
export class BillingModule {}
