import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class PutItemsIntoPickupBagUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: {
    staffId: string;
    runId: string;
    orderId: string;
    bagBarcode: string;
    itemIds: string[];
  }) {
    return this.pickupRepository.putItemsIntoBag({
      ...input,
      bagBarcode: input.bagBarcode.trim().toUpperCase(),
    });
  }
}
