import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ProcessingRouteModule } from '../processing-route/processing-route.module';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { EstimatePricingUseCase } from './application/use-cases/estimate-pricing.use-case';
import { GetCatalogItemDetailUseCase } from './application/use-cases/get-catalog-item-detail.use-case';
import { GetCatalogItemsUseCase } from './application/use-cases/get-catalog-items.use-case';
import { CATALOG_REPOSITORY } from './domain/catalog.repository';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository';
import { CatalogController } from './interfaces/http/catalog.controller';
import { OrdersController } from './interfaces/http/orders.controller';
import { PricingController } from './interfaces/http/pricing.controller';

@Module({
  imports: [PrismaModule, ProcessingRouteModule],
  controllers: [CatalogController, PricingController, OrdersController],
  providers: [
    GetCatalogItemsUseCase,
    GetCatalogItemDetailUseCase,
    EstimatePricingUseCase,
    CreateOrderUseCase,
    {
      provide: CATALOG_REPOSITORY,
      useClass: PrismaCatalogRepository,
    },
  ],
})
export class CatalogModule {}
