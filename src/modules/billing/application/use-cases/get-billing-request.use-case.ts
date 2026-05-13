import { Inject, Injectable } from '@nestjs/common';
import { BillingRequestForbiddenError, BillingRequestNotFoundError } from '../../domain/billing.errors';
import { BILLING_REPOSITORY, BillingRepository } from '../../domain/billing.repository';
import { BillingRequestView } from '../../domain/billing.types';

@Injectable()
export class GetBillingRequestUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repo: BillingRepository,
  ) {}

  async execute(input: { billingRequestId: string; customerId: string }): Promise<BillingRequestView> {
    const billing = await this.repo.findById(input.billingRequestId);
    if (!billing) throw new BillingRequestNotFoundError(input.billingRequestId);

    const ownerCustomerId = await this.repo.findOrderCustomerId(billing.orderId);
    if (ownerCustomerId !== input.customerId) {
      throw new BillingRequestForbiddenError();
    }

    return billing;
  }
}
