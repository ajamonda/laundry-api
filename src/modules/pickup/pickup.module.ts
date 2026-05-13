import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CreatePickupRunUseCase } from './application/use-cases/create-pickup-run.use-case';
import { GetPickupRequestDetailUseCase } from './application/use-cases/get-pickup-request-detail.use-case';
import { GetPickupRequestsUseCase } from './application/use-cases/get-pickup-requests.use-case';
import { HandoffPickupBagUseCase } from './application/use-cases/handoff-pickup-bag.use-case';
import { PutItemsIntoPickupBagUseCase } from './application/use-cases/put-items-into-pickup-bag.use-case';
import { RecordPickupPhotoUseCase } from './application/use-cases/record-pickup-photo.use-case';
import { RegisterPickupBagUseCase } from './application/use-cases/register-pickup-bag.use-case';
import { PICKUP_REPOSITORY } from './domain/pickup.repository';
import { PrismaPickupRepository } from './infrastructure/prisma-pickup.repository';
import { PickupController } from './interfaces/http/pickup.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PickupController],
  providers: [
    GetPickupRequestsUseCase,
    GetPickupRequestDetailUseCase,
    CreatePickupRunUseCase,
    RegisterPickupBagUseCase,
    RecordPickupPhotoUseCase,
    PutItemsIntoPickupBagUseCase,
    HandoffPickupBagUseCase,
    {
      provide: PICKUP_REPOSITORY,
      useClass: PrismaPickupRepository,
    },
  ],
})
export class PickupModule {}
