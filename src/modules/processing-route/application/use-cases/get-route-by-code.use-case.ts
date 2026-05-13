import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROCESSING_ROUTE_REPOSITORY,
  ProcessingRouteRepository,
} from '../../domain/processing-route.repository';

@Injectable()
export class GetRouteByCodeUseCase {
  constructor(
    @Inject(PROCESSING_ROUTE_REPOSITORY)
    private readonly repo: ProcessingRouteRepository,
  ) {}

  async execute(code: string) {
    const route = await this.repo.findRouteByCode(code);
    if (!route) throw new NotFoundException(`Processing route not found: ${code}`);
    return route;
  }
}
