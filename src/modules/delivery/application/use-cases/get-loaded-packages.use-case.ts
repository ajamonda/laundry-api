import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryPackageView } from '../../domain/delivery.types';

@Injectable()
export class GetLoadedPackagesUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  async execute(staffId: string): Promise<DeliveryPackageView[]> {
    const run = await this.repo.findActiveRun(staffId);
    if (!run) return [];
    return this.repo.findLoadedPackages(run.id);
  }
}
