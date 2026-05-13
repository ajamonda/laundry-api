import { Inject, Injectable } from '@nestjs/common';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import {
  CATALOG_REPOSITORY,
  CatalogRepository,
} from '../../domain/catalog.repository';
import { EstimateItemInput } from '../../domain/catalog.types';

const SYSTEM_ACTOR = { actorType: 'STAFF' as const, actorId: 'SYSTEM', staffRole: null };

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: CatalogRepository,
    private readonly routeEngine: RouteEngineService,
  ) {}

  async execute(input: {
    customerId: string;
    pickupSchedule?: Date;
    fulfillmentType?: 'DELIVERY' | 'STORAGE';
    fulfillmentOptionCode?: string;
    address?: string;
    phoneNumber?: string;
    pickupDeliveryPlaceCode?: string;
    pickupDeliveryPlaceText?: string;
    secondHandPickupRequested?: boolean;
    items: EstimateItemInput[];
  }): Promise<{ id: string; estimatedMinAmount: number; estimatedMaxAmount: number }> {
    const result = await this.catalogRepository.createOrder(input);

    for (const { itemId, routeCode } of result.createdItems) {
      if (routeCode) {
        await this.routeEngine.createPlan({
          orderItemId: itemId,
          routeCode,
          actor: SYSTEM_ACTOR,
          reason: 'auto-assigned at order creation',
        });
      }
    }

    return {
      id: result.id,
      estimatedMinAmount: result.estimatedMinAmount,
      estimatedMaxAmount: result.estimatedMaxAmount,
    };
  }
}
