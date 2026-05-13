import { Inject, Injectable } from '@nestjs/common';
import {
  PROCESSING_ROUTE_REPOSITORY,
  ProcessingRouteRepository,
} from '../../domain/processing-route.repository';

@Injectable()
export class GetActiveRoutesUseCase {
  constructor(
    @Inject(PROCESSING_ROUTE_REPOSITORY)
    private readonly repo: ProcessingRouteRepository,
  ) {}

  execute() {
    return this.repo.findActiveRoutes();
  }
}
