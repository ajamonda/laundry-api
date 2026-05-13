import { Inject, Injectable } from '@nestjs/common';
import { BillingAlreadyResolvedError, BillingRequestForbiddenError, BillingRequestNotFoundError } from '../../domain/billing.errors';
import { BILLING_REPOSITORY, BillingRepository } from '../../domain/billing.repository';
import { BillingRequestView } from '../../domain/billing.types';

@Injectable()
export class CancelBillingRequestUseCase {
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

    if (billing.status !== 'WAITING') {
      throw new BillingAlreadyResolvedError(input.billingRequestId);
    }

    return this.repo.resolveRequest(input.billingRequestId, 'CANCELLED', input.customerId);
  }
}
