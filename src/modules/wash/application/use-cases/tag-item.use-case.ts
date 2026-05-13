import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { BillingService } from '../../../billing/domain/billing.service';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import {
  ItemNotTaggableError,
  WashItemNotFoundError,
} from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

/**
 * Atomically: attach tag → create BASE billing → flip status to SORTED if
 * a processing plan already exists. All three writes share one transaction
 * so a mid-sequence failure cannot leave the item tagged without billing,
 * or billed without the expected status.
 */
@Injectable()
export class TagItemUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
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

    return this.prisma.$transaction(async (tx) => {
      const tagged = await this.repo.attachTagBarcode(
        {
          itemId: input.itemId,
          tagBarcode: input.tagBarcode,
          actor: input.actor,
        },
        tx,
      );

      await this.billingService.onItemTagged(
        item.itemId,
        item.orderId,
        item.estimatedMinAmount,
        tx,
      );

      if (tagged.processingState !== null) {
        return this.repo.setItemStatus(
          { itemId: input.itemId, status: 'SORTED' },
          tx,
        );
      }

      return tagged;
    });
  }
}
