import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../../domain/delivery.repository';
import { HandoffPhotoView } from '../../domain/delivery.types';

@Injectable()
export class RecordHandoffPhotoUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly repo: DeliveryRepository,
  ) {}

  execute(input: { packageId: string; url: string }): Promise<HandoffPhotoView> {
    return this.repo.recordHandoffPhoto(input);
  }
}
