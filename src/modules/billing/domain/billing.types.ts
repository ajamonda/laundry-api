export type BillingRequestItemView = {
  id: string;
  orderItemId: string;
  amount: number;
};

export type BillingRequestView = {
  id: string;
  orderId: string;
  type: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  items: BillingRequestItemView[];
};
