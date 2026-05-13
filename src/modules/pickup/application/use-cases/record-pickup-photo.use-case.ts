import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class RecordPickupPhotoUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: {
    staffId: string;
    runId: string;
    orderId: string;
    photoUrl: string;
  }) {
    return this.pickupRepository.recordPickupPhoto(input);
  }
}
