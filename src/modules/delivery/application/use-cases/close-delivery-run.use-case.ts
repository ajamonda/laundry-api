import { Inject, Injectable } from '@nestjs/common';
import { DeliveryRunNotFoundError } from '../../domain/delivery.errors';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryRunView } from '../../domain/delivery.types';

@Injectable()
export class CloseDeliveryRunUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  async execute(input: { runId: string }): Promise<DeliveryRunView> {
    const run = await this.repo.findRunById(input.runId);
    if (!run) throw new DeliveryRunNotFoundError(input.runId);

    return this.repo.closeRun(input.runId);
  }
}
