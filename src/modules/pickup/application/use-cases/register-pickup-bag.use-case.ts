import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class RegisterPickupBagUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: { staffId: string; runId: string; bagBarcode: string }) {
    return this.pickupRepository.registerBag({
      staffId: input.staffId,
      runId: input.runId,
      bagBarcode: input.bagBarcode.trim().toUpperCase(),
    });
  }
}
