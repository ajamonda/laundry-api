export type PriceType = 'FIXED' | 'RANGE' | 'UNIT' | 'MATRIX' | 'NONE';

export type CatalogPrice = {
  id: string;
  priceType: PriceType;
  currency: string;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  baseAmount: number | null;
  baseQuantity: string | null;
  baseUnit: string | null;
  extraUnitQuantity: string | null;
  extraUnitAmount: number | null;
};

export type CatalogOption = {
  id: string;
  code: string;
  displayName: string;
  parentOptionId: string | null;
  requiresInput: boolean;
  inputType: string | null;
  inputUnit: string | null;
  sortOrder: number;
  prices: CatalogPrice[];
  children: CatalogOption[];
};

export type CatalogOptionGroup = {
  id: string;
  code: string;
  displayName: string;
  selectionType: 'SINGLE' | 'MULTI';
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  sortOrder: number;
  options: CatalogOption[];
};

export type CatalogItemInput = {
  id: string;
  code: string;
  displayName: string;
  inputType: string;
  required: boolean;
  sortOrder: number;
};

export type CatalogItemSummary = {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  photoRequired: boolean;
  sortOrder: number;
};

export type CatalogItemDetail = CatalogItemSummary & {
  optionGroups: CatalogOptionGroup[];
  inputs: CatalogItemInput[];
};

export type EstimateSelectedOption = {
  groupCode: string;
  optionCode: string;
  inputValue?: string;
  quantity?: number;
};

export type EstimateItemInput = {
  itemCode: string;
  options: EstimateSelectedOption[];
  inputs?: Array<{ inputCode: string; inputValue: string }>;
  photoUrls?: string[];
};

export type EstimatedOption = {
  groupCode: string;
  optionCode: string;
  displayName: string;
  priceType: PriceType;
  estimatedMinAmount: number;
  estimatedMaxAmount: number;
};

export type EstimatedItem = {
  itemCode: string;
  displayName: string;
  estimatedMinAmount: number;
  estimatedMaxAmount: number;
  selectedOptions: EstimatedOption[];
};

export type PricingEstimate = {
  estimatedMinAmount: number;
  estimatedMaxAmount: number;
  items: EstimatedItem[];
};
