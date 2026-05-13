import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROCESSING_ROUTE_REPOSITORY,
  ProcessingRouteRepository,
} from '../../domain/processing-route.repository';

@Injectable()
export class GetItemProcessingUseCase {
  constructor(
    @Inject(PROCESSING_ROUTE_REPOSITORY)
    private readonly repo: ProcessingRouteRepository,
  ) {}

  async execute(orderItemId: string) {
    const state = await this.repo.findItemProcessing(orderItemId);
    if (!state) throw new NotFoundException(`Processing state not found for item: ${orderItemId}`);
    return state;
  }
}
