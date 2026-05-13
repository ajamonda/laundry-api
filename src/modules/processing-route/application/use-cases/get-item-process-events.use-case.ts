import { Inject, Injectable } from '@nestjs/common';
import {
  PROCESSING_ROUTE_REPOSITORY,
  ProcessingRouteRepository,
} from '../../domain/processing-route.repository';

@Injectable()
export class GetItemProcessEventsUseCase {
  constructor(
    @Inject(PROCESSING_ROUTE_REPOSITORY)
    private readonly repo: ProcessingRouteRepository,
  ) {}

  execute(orderItemId: string) {
    return this.repo.findItemProcessEvents(orderItemId);
  }
}
