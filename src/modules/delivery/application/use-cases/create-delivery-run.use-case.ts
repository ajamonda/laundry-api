import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryRunView } from '../../domain/delivery.types';

@Injectable()
export class CreateDeliveryRunUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  execute(input: { staffId: string; vehicleCode: string }): Promise<DeliveryRunView> {
    return this.repo.createRun(input);
  }
}
