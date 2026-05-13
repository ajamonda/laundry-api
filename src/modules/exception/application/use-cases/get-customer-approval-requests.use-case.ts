import { Inject, Injectable } from '@nestjs/common';
import { EXCEPTION_REPOSITORY, ExceptionRepository } from '../../domain/exception.repository';
import { ApprovalRequestView } from '../../domain/exception.types';

@Injectable()
export class GetCustomerApprovalRequestsUseCase {
  constructor(
    @Inject(EXCEPTION_REPOSITORY)
    private readonly repo: ExceptionRepository,
  ) {}

  execute(customerId: string): Promise<ApprovalRequestView[]> {
    return this.repo.findPendingApprovalsByCustomerId(customerId);
  }
}
