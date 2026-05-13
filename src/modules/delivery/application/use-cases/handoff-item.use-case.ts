import { Inject, Injectable } from '@nestjs/common';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { PackageNotFoundError, PackageNotHandoffableError } from '../../domain/delivery.errors';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { PackageHandoffResult } from '../../domain/delivery.types';

@Injectable()
export class HandoffItemUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  async execute(input: { packageId: string; actor: ActorContext }): Promise<PackageHandoffResult> {
    const pkg = await this.repo.findPackageById(input.packageId);
    if (!pkg) throw new PackageNotFoundError(input.packageId);

    const allDelivering = pkg.items.every((i) => i.status === 'DELIVERING');
    if (!allDelivering) throw new PackageNotHandoffableError(input.packageId);

    return this.repo.handoffPackage({ packageId: input.packageId, actor: input.actor });
  }
}
