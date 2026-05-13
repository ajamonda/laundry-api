import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryPackageView } from '../../domain/delivery.types';

@Injectable()
export class GetDeliveryWorkUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  execute(): Promise<DeliveryPackageView[]> {
    return this.repo.findDeliveryPackages();
  }
}
