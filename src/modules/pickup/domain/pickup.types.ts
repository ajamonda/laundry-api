export type PickupRunStatus = 'ACTIVE' | 'RETURNED';

export type PickupRequestDetail = {
  orderId: string;
  customerId: string;
  status: string;
  pickupSchedule: Date | null;
  address: string | null;
  phoneNumber: string | null;
  fulfillmentType: string | null;
  fulfillmentOptionCode: string | null;
  pickupDeliveryPlaceCode: string | null;
  pickupDeliveryPlaceText: string | null;
  secondHandPickupRequested: boolean;
  items: Array<{
    itemId: string;
    catalogItemCode: string;
    displayNameSnapshot: string;
    status: string;
    location: string;
    options: Array<{
      groupCodeSnapshot: string;
      optionCodeSnapshot: string;
      displayNameSnapshot: string;
    }>;
    inputs: Array<{ inputCode: string; inputValue: string }>;
    photoUrls: string[];
  }>;
};
export type PickupBagStatus = 'READY' | 'TAKE_OUT' | 'CONTAIN' | 'TAKE_BACK';

export type PickupRequestSummary = {
  orderId: string;
  customerId: string;
  pickupSchedule: Date | null;
  address: string | null;
  phoneNumber: string | null;
  pickupDeliveryPlaceCode: string | null;
  pickupDeliveryPlaceText: string | null;
  secondHandPickupRequested: boolean;
  status: 'REQUEST';
  itemCount: number;
  createdAt: Date;
};

export type PaginatedPickupRequests = {
  items: PickupRequestSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type PickupRunResult = {
  runId: string;
  vehicle: {
    code: string;
    displayName: string;
  };
  staffId: string;
  status: PickupRunStatus;
  startedAt: Date;
};

export type PickupBagResult = {
  bagId: string;
  barcode: string;
  status: PickupBagStatus;
  runId: string | null;
};

export type PickupPhotoResult = {
  photoId: string;
  orderId: string;
  runId: string;
  staffId: string;
  photoUrl: string;
  createdAt: Date;
};

export type PickupContainmentResult = {
  runId: string;
  bag: PickupBagResult;
  order: {
    orderId: string;
    status: 'PICK_UP';
  };
  items: Array<{
    itemId: string;
    status: 'PICK_UP';
    location: 'PICK_UP_TRUCK';
  }>;
};

export type PickupHandoffResult = {
  runId: string;
  runStatus: PickupRunStatus;
  bag: PickupBagResult;
  orders: Array<{
    orderId: string;
    status: 'PROCESSING';
  }>;
  items: Array<{
    itemId: string;
    status: 'PICK_UP';
    location: 'IN_HOUSE';
  }>;
};
