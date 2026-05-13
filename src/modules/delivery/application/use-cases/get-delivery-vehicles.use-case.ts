import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryVehicleView } from '../../domain/delivery.types';

@Injectable()
export class GetDeliveryVehiclesUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  execute(): Promise<DeliveryVehicleView[]> {
    return this.repo.findActiveVehicles();
  }
}
