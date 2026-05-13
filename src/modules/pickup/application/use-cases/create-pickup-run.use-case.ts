import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class CreatePickupRunUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: { staffId: string; vehicleCode: string }) {
    return this.pickupRepository.createRun({
      staffId: input.staffId,
      vehicleCode: input.vehicleCode.trim().toUpperCase(),
    });
  }
}
