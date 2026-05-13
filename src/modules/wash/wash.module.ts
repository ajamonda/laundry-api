import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ProcessingRouteModule } from '../processing-route/processing-route.module';
import { AssignRouteUseCase } from './application/use-cases/assign-route.use-case';
import { CreatePackageUseCase } from './application/use-cases/create-package.use-case';
import { FindItemByTagUseCase } from './application/use-cases/find-item-by-tag.use-case';
import { GetBagUseCase } from './application/use-cases/get-bag.use-case';
import { GetOrderItemsUseCase } from './application/use-cases/get-order-items.use-case';
import { GetProcessingQueueUseCase } from './application/use-cases/get-processing-queue.use-case';
import { ScanStepUseCase } from './application/use-cases/scan-step.use-case';
import { TagItemUseCase } from './application/use-cases/tag-item.use-case';
import { WASH_REPOSITORY } from './domain/wash.repository';
import { PrismaWashRepository } from './infrastructure/prisma-wash.repository';
import { WashController } from './interfaces/http/wash.controller';

@Module({
  imports: [PrismaModule, AuthModule, ProcessingRouteModule, BillingModule],
  controllers: [WashController],
  providers: [
    GetBagUseCase,
    FindItemByTagUseCase,
    TagItemUseCase,
    AssignRouteUseCase,
    ScanStepUseCase,
    CreatePackageUseCase,
    GetProcessingQueueUseCase,
    GetOrderItemsUseCase,
    {
      provide: WASH_REPOSITORY,
      useClass: PrismaWashRepository,
    },
  ],
})
export class WashModule {}
