import { ActorContext } from '../../processing-route/domain/processing-route.types';
import { ApprovalRequestView, IssueView } from './exception.types';

export const EXCEPTION_REPOSITORY = Symbol('EXCEPTION_REPOSITORY');

export interface ExceptionRepository {
  findItemStatus(itemId: string): Promise<{ status: string } | null>;
  createIssue(input: {
    itemId: string;
    issueType: string;
    note: string | null;
    actor: ActorContext;
  }): Promise<IssueView>;
  findPendingApprovalsByCustomerId(customerId: string): Promise<ApprovalRequestView[]>;
}
