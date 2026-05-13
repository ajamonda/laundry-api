import {
  PaginatedPickupRequests,
  PickupBagResult,
  PickupContainmentResult,
  PickupHandoffResult,
  PickupPhotoResult,
  PickupRequestDetail,
  PickupRunResult,
} from './pickup.types';

export const PICKUP_REPOSITORY = Symbol('PICKUP_REPOSITORY');

export interface PickupRepository {
  findRequestPage(input: {
    page: number;
    pageSize: number;
  }): Promise<PaginatedPickupRequests>;

  findRequestDetail(orderId: string): Promise<PickupRequestDetail | null>;

  createRun(input: {
    staffId: string;
    vehicleCode: string;
  }): Promise<PickupRunResult>;

  registerBag(input: {
    staffId: string;
    runId: string;
    bagBarcode: string;
  }): Promise<PickupBagResult>;

  recordPickupPhoto(input: {
    staffId: string;
    runId: string;
    orderId: string;
    photoUrl: string;
  }): Promise<PickupPhotoResult>;

  putItemsIntoBag(input: {
    staffId: string;
    runId: string;
    orderId: string;
    bagBarcode: string;
    itemIds: string[];
  }): Promise<PickupContainmentResult>;

  handoffBag(input: {
    staffId: string;
    runId: string;
    bagBarcode: string;
  }): Promise<PickupHandoffResult>;
}
