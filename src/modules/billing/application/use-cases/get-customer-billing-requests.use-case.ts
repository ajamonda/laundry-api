import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_REPOSITORY,
  BillingRepository,
} from '../../domain/billing.repository';
import { BillingRequestView } from '../../domain/billing.types';

@Injectable()
export class GetCustomerBillingRequestsUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repo: BillingRepository,
  ) {}

  execute(customerId: string): Promise<BillingRequestView[]> {
    return this.repo.findPendingByCustomerId(customerId);
  }
}
