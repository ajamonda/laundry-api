import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PICKUP_REPOSITORY, PickupRepository } from '../../domain/pickup.repository';

@Injectable()
export class GetPickupRequestDetailUseCase {
  constructor(
    @Inject(PICKUP_REPOSITORY)
    private readonly pickupRepository: PickupRepository,
  ) {}

  async execute(orderId: string) {
    const detail = await this.pickupRepository.findRequestDetail(orderId);
    if (!detail) throw new NotFoundException('Pickup request not found.');
    return detail;
  }
}
