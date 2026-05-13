import {
  CatalogItemDetail,
  CatalogItemSummary,
  EstimateItemInput,
  PricingEstimate,
} from './catalog.types';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogRepository {
  findActiveItems(): Promise<CatalogItemSummary[]>;
  findActiveItemByCode(code: string): Promise<CatalogItemDetail | null>;
  estimateItems(items: EstimateItemInput[]): Promise<PricingEstimate>;
  createOrder(input: {
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
  }): Promise<{
    id: string;
    estimatedMinAmount: number;
    estimatedMaxAmount: number;
    createdItems: Array<{ itemId: string; routeCode: string | null }>;
  }>;
}
