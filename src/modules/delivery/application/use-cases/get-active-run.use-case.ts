import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryRunView } from '../../domain/delivery.types';

@Injectable()
export class GetActiveRunUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  execute(staffId: string): Promise<DeliveryRunView | null> {
    return this.repo.findActiveRun(staffId);
  }
}
