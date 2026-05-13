import { Inject, Injectable } from '@nestjs/common';
import { BillingService } from '../../../billing/domain/billing.service';
import { AuditLogger } from '../../../processing-route/domain/audit-logger';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import {
  ItemNotTaggableError,
  WashItemNotFoundError,
} from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

@Injectable()
export class TagItemUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly auditLogger: AuditLogger,
    private readonly billingService: BillingService,
  ) {}

  async execute(input: {
    itemId: string;
    tagBarcode: string;
    actor: ActorContext;
  }) {
    const item = await this.repo.findItem(input.itemId);
    if (!item) throw new WashItemNotFoundError(input.itemId);
    if (item.status !== 'PICK_UP' || item.location !== 'IN_HOUSE') {
      throw new ItemNotTaggableError(input.itemId);
    }

    const tagged = await this.repo.attachTagBarcode({
      itemId: input.itemId,
      tagBarcode: input.tagBarcode,
      actor: input.actor,
    });

    await this.billingService.onItemTagged(item.itemId, item.orderId, item.estimatedMinAmount);

    if (tagged.processingState !== null) {
      return this.repo.setItemStatus({ itemId: input.itemId, status: 'SORTED' });
    }

    return tagged;
  }
}
