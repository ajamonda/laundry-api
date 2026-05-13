export type DeliveryVehicleView = {
  code: string;
  displayName: string;
};

export type DeliveryRunView = {
  id: string;
  staffId: string;
  vehicleCode: string;
  vehicleDisplayName: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
};

export type DeliveryPackageItem = {
  itemId: string;
  tagBarcode: string | null;
  catalogItemCode: string;
  displayNameSnapshot: string;
  status: string;
};

export type DeliveryPackageView = {
  packageId: string;
  orderId: string;
  address: string | null;
  phoneNumber: string | null;
  fulfillmentType: string | null;
  fulfillmentOptionCode: string | null;
  pickupDeliveryPlaceCode: string | null;
  pickupDeliveryPlaceText: string | null;
  items: DeliveryPackageItem[];
  handoffPhoto: HandoffPhotoView | null;
};

export type HandoffPhotoView = {
  id: string;
  packageId: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PackageScanOutboundResult = {
  packageId: string;
  orderId: string;
  items: { itemId: string; status: string; location: string }[];
};

export type PackageHandoffResult = {
  packageId: string;
  orderId: string;
  items: { itemId: string; status: string; location: string }[];
  orderStatus: string;
};
