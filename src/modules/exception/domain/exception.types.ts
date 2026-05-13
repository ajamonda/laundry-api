export type IssueView = {
  id: string;
  orderItemId: string;
  issueType: string;
  note: string | null;
  raisedBy: string;
  createdAt: Date;
};

export type RaiseIssueResult = {
  issue: IssueView;
};

export type ApprovalRequestView = {
  approvalRequestId: string;
  flowCode: string;
  itemId: string;
  options: unknown;
  status: string;
  createdAt: Date;
};
