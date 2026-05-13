import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ExceptionModule } from './modules/exception/exception.module';
import { PickupModule } from './modules/pickup/pickup.module';
import { ProcessingRouteModule } from './modules/processing-route/processing-route.module';
import { WashModule } from './modules/wash/wash.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CatalogModule,
    PickupModule,
    ProcessingRouteModule,
    WashModule,
    ExceptionModule,
    BillingModule,
    DeliveryModule,
  ],
})
export class AppModule {}
