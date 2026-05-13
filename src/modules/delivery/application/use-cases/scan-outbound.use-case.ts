import { Inject, Injectable } from '@nestjs/common';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import {
  ActiveRunNotFoundError,
  BillingNotPaidError,
  PackageNotDeliverableError,
  PackageNotFoundError,
} from '../../domain/delivery.errors';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { PackageScanOutboundResult } from '../../domain/delivery.types';

@Injectable()
export class ScanOutboundUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  async execute(input: { packageId: string; actor: ActorContext }): Promise<PackageScanOutboundResult> {
    const pkg = await this.repo.findPackageById(input.packageId);
    if (!pkg) throw new PackageNotFoundError(input.packageId);

    const allReady = pkg.items.every((i) => i.status === 'READY_FOR_DELIVERY');
    if (!allReady) throw new PackageNotDeliverableError(input.packageId);

    // 그 order의 BASE/SUPPLEMENT 통틀어 WAITING이 한 건이라도 있으면 출고 불가.
    const unpaid = await this.repo.countWaitingBillings(pkg.orderId);
    if (unpaid > 0) throw new BillingNotPaidError(pkg.orderId);

    const run = await this.repo.findActiveRun(input.actor.actorId);
    if (!run) throw new ActiveRunNotFoundError();

    return this.repo.scanOutbound({ packageId: input.packageId, runId: run.id, actor: input.actor });
  }
}
