import { Inject, Injectable } from '@nestjs/common';
import { PackageNotFoundError } from '../../domain/delivery.errors';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { DeliveryPackageView } from '../../domain/delivery.types';

@Injectable()
export class GetDeliveryPackageUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  async execute(packageId: string): Promise<DeliveryPackageView> {
    const pkg = await this.repo.findPackageById(packageId);
    if (!pkg) throw new PackageNotFoundError(packageId);
    return pkg;
  }
}
