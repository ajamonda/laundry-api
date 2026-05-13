import { Inject, Injectable } from '@nestjs/common';
import {
  PICKUP_REPOSITORY,
  PickupRepository,
} from '../../domain/pickup.repository';

@Injectable()
export class GetPickupRequestsUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  execute(input: { page?: number; pageSize?: number }) {
    const page = this.normalizePositiveInt(input.page, 1);
    const pageSize = Math.min(this.normalizePositiveInt(input.pageSize, 20), 50);

    return this.pickupRepository.findRequestPage({ page, pageSize });
  }

  private normalizePositiveInt(value: number | undefined, fallback: number) {
    if (!value || !Number.isFinite(value) || value < 1) {
      return fallback;
    }

    return Math.floor(value);
  }
}
