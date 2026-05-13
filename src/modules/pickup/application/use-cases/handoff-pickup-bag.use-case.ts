import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class HandoffPickupBagUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: { staffId: string; runId: string; bagBarcode: string }) {
    return this.pickupRepository.handoffBag({
      ...input,
      bagBarcode: input.bagBarcode.trim().toUpperCase(),
    });
  }
}
