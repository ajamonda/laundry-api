import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProcessingRouteModule } from '../processing-route/processing-route.module';
import { CloseDeliveryRunUseCase } from './application/use-cases/close-delivery-run.use-case';
import { CreateDeliveryRunUseCase } from './application/use-cases/create-delivery-run.use-case';
import { GetActiveRunUseCase } from './application/use-cases/get-active-run.use-case';
import { GetDeliveryPackageUseCase } from './application/use-cases/get-delivery-package.use-case';
import { GetDeliveryVehiclesUseCase } from './application/use-cases/get-delivery-vehicles.use-case';
import { GetDeliveryWorkUseCase } from './application/use-cases/get-delivery-work.use-case';
import { GetLoadedPackagesUseCase } from './application/use-cases/get-loaded-packages.use-case';
import { HandoffItemUseCase } from './application/use-cases/handoff-item.use-case';
import { RecordHandoffPhotoUseCase } from './application/use-cases/record-handoff-photo.use-case';
import { ScanOutboundUseCase } from './application/use-cases/scan-outbound.use-case';
import { DELIVERY_REPOSITORY } from './domain/delivery.repository';
import { PrismaDeliveryRepository } from './infrastructure/prisma-delivery.repository';
import { DeliveryController } from './interfaces/http/delivery.controller';

@Module({
  imports: [PrismaModule, AuthModule, ProcessingRouteModule],
  controllers: [DeliveryController],
  providers: [
    GetDeliveryVehiclesUseCase,
    GetActiveRunUseCase,
    GetDeliveryPackageUseCase,
    GetDeliveryWorkUseCase,
    GetLoadedPackagesUseCase,
    CreateDeliveryRunUseCase,
    ScanOutboundUseCase,
    HandoffItemUseCase,
    RecordHandoffPhotoUseCase,
    CloseDeliveryRunUseCase,
    { provide: DELIVERY_REPOSITORY, useClass: PrismaDeliveryRepository },
  ],
})
export class DeliveryModule {}
