import { CurrentStateView } from '../../processing-route/domain/processing-route.types';

export type WashItemSelectedOption = {
  groupCode: string;
  optionCode: string;
  displayName: string;
  inputValue: string | null;
  quantity: number | null;
};

export type WashItemView = {
  itemId: string;
  orderId: string;
  catalogItemCode: string;
  displayNameSnapshot: string;
  status: string;
  location: string;
  tagBarcode: string | null;
  estimatedMinAmount: number;
  processingState: CurrentStateView | null;
  selectedOptions: WashItemSelectedOption[];
  inputs: { inputCode: string; inputValue: string }[];
};

export type BagView = {
  bagBarcode: string;
  items: WashItemView[];
};

export type OrderItemsView = {
  orderId: string;
  items: WashItemView[];
};

export type AssignRouteResult = {
  item: WashItemView;
  processingState: CurrentStateView;
};

export type ScanStepResult = {
  item: WashItemView;
  processingState: CurrentStateView;
};

export type PackageView = {
  packageId: string;
  orderId: string;
  items: { itemId: string; tagBarcode: string | null }[];
  createdAt: Date;
};

export type ProcessingQueueItem = {
  itemId: string;
  orderId: string;
  tagBarcode: string | null;
  displayNameSnapshot: string;
  status: string;
  routeCode: string;
  currentStep: {
    stepType: string;
    displayName: string;
    sortOrder: number;
    status: string;
  } | null;
  nextStep: {
    stepType: string;
    displayName: string;
    sortOrder: number;
  } | null;
  isPlanCompleted: boolean;
};
